import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

// GET /api/manual-sales?shiftId=... — protegido. Lista ventas registradas en un turno.
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
    const sales = await db.query(
      `SELECT * FROM manual_sales WHERE shift_id = $1 ORDER BY created_at DESC`,
      [shiftId]
    );
    return NextResponse.json({ sales });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudieron cargar las ventas." },
      { status: 500 }
    );
  }
}

// POST /api/manual-sales — protegido. Registra una venta de mostrador.
export async function POST(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const { shiftId, branchId, amount, paymentMethod, description } = body;

  if (!shiftId || !branchId || !amount || !paymentMethod) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios." },
      { status: 400 }
    );
  }

  try {
    const db = sql();
    const result = await db.query(
      `INSERT INTO manual_sales (shift_id, branch_id, amount, payment_method, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [shiftId, branchId, amount, paymentMethod, description || null]
    );
    return NextResponse.json({ ok: true, sale: result[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo registrar la venta." },
      { status: 500 }
    );
  }
}

// DELETE /api/manual-sales?id=... — protegido.
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
    await db.query(`DELETE FROM manual_sales WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo eliminar la venta." },
      { status: 500 }
    );
  }
}
