import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

// GET /api/cash-movements?shiftId=... — protegido. Lista movimientos de un turno.
export async function GET(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const shiftId = request.nextUrl.searchParams.get("shiftId");
  if (!shiftId) {
    return NextResponse.json({ error: "Falta shiftId." }, { status: 400 });
  }

  try {
    const db = sql();
    const movements = await db.query(
      `SELECT * FROM cash_movements WHERE shift_id = $1 ORDER BY created_at DESC`,
      [shiftId]
    );
    return NextResponse.json({ movements });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudieron cargar los movimientos." },
      { status: 500 }
    );
  }
}

// POST /api/cash-movements — protegido. Registra un ingreso/egreso manual.
export async function POST(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const { shiftId, branchId, type, amount, paymentMethod, description } = body;

  if (!shiftId || !branchId || !type || !amount || !description) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios." },
      { status: 400 }
    );
  }
  if (type !== "ingreso" && type !== "egreso") {
    return NextResponse.json(
      { error: "type debe ser 'ingreso' o 'egreso'." },
      { status: 400 }
    );
  }

  try {
    const db = sql();
    const result = await db.query(
      `INSERT INTO cash_movements (shift_id, branch_id, type, amount, payment_method, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        shiftId,
        branchId,
        type,
        amount,
        paymentMethod || "efectivo",
        description,
      ]
    );
    return NextResponse.json({ ok: true, movement: result[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo registrar el movimiento." },
      { status: 500 }
    );
  }
}

// DELETE /api/cash-movements?id=... — protegido. Elimina un movimiento (ej. si se ingresó mal).
export async function DELETE(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el id." }, { status: 400 });
  }

  try {
    const db = sql();
    await db.query(`DELETE FROM cash_movements WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo eliminar el movimiento." },
      { status: 500 }
    );
  }
}
