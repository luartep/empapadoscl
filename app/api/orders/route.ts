import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

// POST /api/orders — público. Se llama justo antes de abrir el link de
// WhatsApp, para que el pedido quede guardado en el panel aunque el
// cliente no termine de enviarlo por WhatsApp.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    customerName,
    orderType,
    address = null,
    pickupLocation = null,
    items,
    total,
  } = body;

  if (!customerName || !orderType || !items || total == null) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios del pedido." },
      { status: 400 }
    );
  }

  try {
    const db = sql();
    const result = await db.query(
      `INSERT INTO orders (customer_name, order_type, address, pickup_location, items, total)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        customerName,
        orderType,
        address,
        pickupLocation,
        JSON.stringify(items),
        total,
      ]
    );
    const id = (result[0] as { id: number }).id;
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error(err);
    // No bloqueamos el flujo de WhatsApp si falla el guardado: el pedido
    // sigue funcionando para el cliente aunque no quede en el panel.
    return NextResponse.json(
      { error: "No se pudo guardar el pedido en el panel." },
      { status: 500 }
    );
  }
}

// GET /api/orders — protegido. Lista los pedidos para el panel.
export async function GET() {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const db = sql();
    const orders = await db.query(
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`
    );
    return NextResponse.json({ orders });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudieron cargar los pedidos." },
      { status: 500 }
    );
  }
}

// PATCH /api/orders — protegido. Cambia el estado de un pedido (pendiente/completado).
export async function PATCH(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json(
      { error: "Faltan campos (id, status)." },
      { status: 400 }
    );
  }

  try {
    const db = sql();
    await db.query(`UPDATE orders SET status = $2 WHERE id = $1`, [id, status]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo actualizar el pedido." },
      { status: 500 }
    );
  }
}
