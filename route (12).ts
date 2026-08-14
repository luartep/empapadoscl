import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

// POST /api/orders/mark-paid-from-pos — protegido.
// Usado internamente por el POS de caja para vincular un pedido recién creado
// con la venta de caja correspondiente, SIN crear una nueva manual_sale
// (porque el POS ya la crea directamente en /api/manual-sales).
export async function POST(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const { orderId, paymentMethod, cashSaleId } = body;

  if (!orderId || !paymentMethod) {
    return NextResponse.json({ error: "Faltan campos." }, { status: 400 });
  }

  try {
    const db = sql();
    await db.query(
      `UPDATE orders SET
        payment_status = 'pagado',
        payment_method = $2,
        paid_at = now(),
        cash_sale_id = $3
       WHERE id = $1`,
      [orderId, paymentMethod, cashSaleId ?? null]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo vincular el pedido con la caja." },
      { status: 500 }
    );
  }
}
