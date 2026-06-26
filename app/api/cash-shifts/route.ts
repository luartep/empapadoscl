import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

/**
 * Turnos de caja.
 *
 * GET    /api/cash-shifts            → lista turnos (con filtro opcional ?branchId=&status=)
 * POST   /api/cash-shifts            → abre un turno nuevo { branchId, openingCash }
 * PATCH  /api/cash-shifts            → cierra un turno con arqueo { id, closingType, countedCash, countedCard, countedTransfer, notes }
 */

async function requireAuth() {
  return getSessionFromCookies();
}

export async function GET(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const branchId = request.nextUrl.searchParams.get("branchId");
  const status = request.nextUrl.searchParams.get("status");

  try {
    const db = sql();
    let shifts;
    if (branchId && status) {
      shifts = await db.query(
        `SELECT * FROM cash_shifts WHERE branch_id = $1 AND status = $2 ORDER BY opened_at DESC LIMIT 100`,
        [branchId, status]
      );
    } else if (branchId) {
      shifts = await db.query(
        `SELECT * FROM cash_shifts WHERE branch_id = $1 ORDER BY opened_at DESC LIMIT 100`,
        [branchId]
      );
    } else if (status) {
      shifts = await db.query(
        `SELECT * FROM cash_shifts WHERE status = $1 ORDER BY opened_at DESC LIMIT 100`,
        [status]
      );
    } else {
      shifts = await db.query(
        `SELECT * FROM cash_shifts ORDER BY opened_at DESC LIMIT 100`
      );
    }
    return NextResponse.json({ shifts });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudieron cargar los turnos." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const { branchId, openingCash } = body;

  if (!branchId || openingCash == null) {
    return NextResponse.json(
      { error: "Faltan campos (branchId, openingCash)." },
      { status: 400 }
    );
  }

  try {
    const db = sql();
    const result = await db.query(
      `INSERT INTO cash_shifts (branch_id, opening_cash) VALUES ($1, $2) RETURNING *`,
      [branchId, openingCash]
    );
    return NextResponse.json({ ok: true, shift: result[0] });
  } catch (err: any) {
    console.error(err);
    const message =
      err?.code === "23505"
        ? "Ya hay un turno abierto en esa sucursal. Cierra el turno actual antes de abrir uno nuevo."
        : "No se pudo abrir el turno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const {
    id,
    closingType,
    countedCash: rawCountedCash,
    countedCard: rawCountedCard,
    countedTransfer: rawCountedTransfer,
    notes,
  } = body;

  const countedCash = Number(rawCountedCash ?? 0);
  const countedCard = Number(rawCountedCard ?? 0);
  const countedTransfer = Number(rawCountedTransfer ?? 0);

  if (!id || !closingType) {
    return NextResponse.json(
      { error: "Faltan campos (id, closingType)." },
      { status: 400 }
    );
  }

  try {
    const db = sql();

    // Trae el turno para conocer su monto inicial y hora de apertura.
    const shiftRows = await db.query(
      `SELECT * FROM cash_shifts WHERE id = $1`,
      [id]
    );
    const shift = shiftRows[0] as
      | { id: number; branch_id: string; opening_cash: number; status: string }
      | undefined;

    if (!shift) {
      return NextResponse.json(
        { error: "Turno no encontrado." },
        { status: 404 }
      );
    }
    if (shift.status === "cerrado") {
      return NextResponse.json(
        { error: "Este turno ya está cerrado." },
        { status: 400 }
      );
    }

    // Suma de ventas manuales del turno, por medio de pago.
    const salesRows = await db.query(
      `SELECT payment_method, COALESCE(SUM(amount), 0) AS total
       FROM manual_sales WHERE shift_id = $1 GROUP BY payment_method`,
      [id]
    );
    const salesByMethod: Record<string, number> = {};
    (salesRows as { payment_method: string; total: number }[]).forEach(
      (r) => (salesByMethod[r.payment_method] = Number(r.total))
    );

    // Suma de movimientos manuales del turno, por medio de pago (ingresos positivos, egresos negativos).
    const movementRows = await db.query(
      `SELECT payment_method,
              COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount ELSE -amount END), 0) AS net
       FROM cash_movements WHERE shift_id = $1 GROUP BY payment_method`,
      [id]
    );
    const movementsByMethod: Record<string, number> = {};
    (movementRows as { payment_method: string; net: number }[]).forEach(
      (r) => (movementsByMethod[r.payment_method] = Number(r.net))
    );

    const expectedCash =
      Number(shift.opening_cash) +
      (salesByMethod["efectivo"] || 0) +
      (movementsByMethod["efectivo"] || 0);
    const expectedCard =
      (salesByMethod["tarjeta"] || 0) + (movementsByMethod["tarjeta"] || 0);
    const expectedTransfer =
      (salesByMethod["transferencia"] || 0) +
      (movementsByMethod["transferencia"] || 0);

    await db.query(
      `UPDATE cash_shifts SET
        status = 'cerrado',
        closing_type = $2,
        counted_cash = $3,
        counted_card = $4,
        counted_transfer = $5,
        expected_cash = $6,
        expected_card = $7,
        expected_transfer = $8,
        notes = $9,
        closed_at = now()
       WHERE id = $1`,
      [
        id,
        closingType,
        countedCash,
        countedCard,
        countedTransfer,
        expectedCash,
        expectedCard,
        expectedTransfer,
        notes || null,
      ]
    );

    return NextResponse.json({
      ok: true,
      expected: {
        cash: expectedCash,
        card: expectedCard,
        transfer: expectedTransfer,
      },
      difference: {
        cash: countedCash - expectedCash,
        card: countedCard - expectedCard,
        transfer: countedTransfer - expectedTransfer,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo cerrar el turno." },
      { status: 500 }
    );
  }
}
