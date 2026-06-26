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

  // Si el pedido se retira en una sucursal específica, lo pre-asignamos
  // directamente a esa sucursal. Si es delivery, queda sin asignar hasta
  // que el admin lo asigne manualmente desde el panel.
  const branchId = orderType === "retiro" ? pickupLocation : null;

  try {
    const db = sql();
    const result = await db.query(
      `INSERT INTO orders (customer_name, order_type, address, pickup_location, items, total, branch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        customerName,
        orderType,
        address,
        pickupLocation,
        JSON.stringify(items),
        total,
        branchId,
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
// Acepta ?branchId= para filtrar por sucursal (admin viendo una sola sucursal).
export async function GET(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const branchId = request.nextUrl.searchParams.get("branchId");

  try {
    const db = sql();
    const orders = branchId
      ? await db.query(
          `SELECT * FROM orders WHERE branch_id = $1 ORDER BY created_at DESC LIMIT 200`,
          [branchId]
        )
      : await db.query(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`);
    return NextResponse.json({ orders });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudieron cargar los pedidos." },
      { status: 500 }
    );
  }
}

// PATCH /api/orders — protegido. Cambia el estado (pendiente/completado)
// y/o reasigna la sucursal de un pedido.
export async function PATCH(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const { id, status, branchId } = body;

  if (!id) {
    return NextResponse.json({ error: "Falta el id." }, { status: 400 });
  }
  if (status == null && branchId === undefined) {
    return NextResponse.json(
      { error: "Nada que actualizar (status o branchId)." },
      { status: 400 }
    );
  }

  try {
    const db = sql();
    if (status != null && branchId !== undefined) {
      await db.query(
        `UPDATE orders SET status = $2, branch_id = $3 WHERE id = $1`,
        [id, status, branchId]
      );
    } else if (status != null) {
      await db.query(`UPDATE orders SET status = $2 WHERE id = $1`, [
        id,
        status,
      ]);
    } else {
      await db.query(`UPDATE orders SET branch_id = $2 WHERE id = $1`, [
        id,
        branchId,
      ]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo actualizar el pedido." },
      { status: 500 }
    );
  }
}

// DELETE /api/orders?id=... — protegido. Elimina un pedido permanentemente.
export async function DELETE(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Falta el id del pedido a eliminar." },
      { status: 400 }
    );
  }

  try {
    const db = sql();
    await db.query(`DELETE FROM orders WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo eliminar el pedido." },
      { status: 500 }
    );
  }
}
