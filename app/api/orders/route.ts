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

// PATCH /api/orders — protegido. Actualiza cualquier combinación de:
//   - prepStatus: 'en_preparacion' | 'en_reparto' | 'entregado'
//   - branchId: reasigna la sucursal
//   - markPaid: { paymentMethod: 'efectivo'|'tarjeta'|'transferencia' }
//       → marca el pedido como pagado y registra automáticamente la venta
//         en el turno de caja abierto de su sucursal.
//   - unmarkPaid: true → revierte el pago (y borra la venta de caja asociada,
//       si la hubiera, para no dejar un monto fantasma en el arqueo).
export async function PATCH(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const { id, prepStatus, branchId, markPaid, unmarkPaid, status } = body;

  if (!id) {
    return NextResponse.json({ error: "Falta el id." }, { status: 400 });
  }

  try {
    const db = sql();

    // --- Compatibilidad con el campo viejo "status" (pendiente/completado) ---
    if (status != null && prepStatus == null) {
      await db.query(`UPDATE orders SET status = $2 WHERE id = $1`, [
        id,
        status,
      ]);
    }

    if (prepStatus != null) {
      await db.query(`UPDATE orders SET prep_status = $2 WHERE id = $1`, [
        id,
        prepStatus,
      ]);
    }

    if (branchId !== undefined) {
      await db.query(`UPDATE orders SET branch_id = $2 WHERE id = $1`, [
        id,
        branchId,
      ]);
    }

    // --- Marcar como pagado: crea la venta en caja automáticamente ---
    if (markPaid) {
      const { paymentMethod } = markPaid;
      if (!paymentMethod) {
        return NextResponse.json(
          { error: "Falta el medio de pago." },
          { status: 400 }
        );
      }

      const orderRows = await db.query(`SELECT * FROM orders WHERE id = $1`, [
        id,
      ]);
      const order = orderRows[0] as
        | {
            id: number;
            branch_id: string | null;
            total: number;
            customer_name: string;
            payment_status: string;
            cash_sale_id: number | null;
          }
        | undefined;

      if (!order) {
        return NextResponse.json(
          { error: "Pedido no encontrado." },
          { status: 404 }
        );
      }
      if (!order.branch_id) {
        return NextResponse.json(
          {
            error:
              "Este pedido no tiene sucursal asignada todavía. Asígnalo a una sucursal antes de marcarlo como pagado, para que la venta quede en la caja correcta.",
          },
          { status: 400 }
        );
      }

      // Busca el turno abierto de esa sucursal.
      const shiftRows = await db.query(
        `SELECT id FROM cash_shifts WHERE branch_id = $1 AND status = 'abierto'`,
        [order.branch_id]
      );
      const openShift = shiftRows[0] as { id: number } | undefined;

      if (!openShift) {
        return NextResponse.json(
          {
            error:
              "No hay un turno de caja abierto en esa sucursal. Abre un turno en /admin/cash antes de marcar pedidos como pagados.",
          },
          { status: 400 }
        );
      }

      // Si ya estaba pagado con una venta asociada, la eliminamos primero
      // para no duplicar (ej. si se cambia de "tarjeta" a "efectivo").
      if (order.cash_sale_id) {
        await db.query(`DELETE FROM manual_sales WHERE id = $1`, [
          order.cash_sale_id,
        ]);
      }

      const saleResult = await db.query(
        `INSERT INTO manual_sales (shift_id, branch_id, amount, payment_method, description)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          openShift.id,
          order.branch_id,
          order.total,
          paymentMethod,
          `Pedido #${order.id} — ${order.customer_name}`,
        ]
      );
      const saleId = (saleResult[0] as { id: number }).id;

      await db.query(
        `UPDATE orders SET
          payment_status = 'pagado',
          payment_method = $2,
          paid_at = now(),
          cash_sale_id = $3
         WHERE id = $1`,
        [id, paymentMethod, saleId]
      );
    }

    // --- Revertir pago ---
    if (unmarkPaid) {
      const orderRows = await db.query(
        `SELECT cash_sale_id FROM orders WHERE id = $1`,
        [id]
      );
      const order = orderRows[0] as { cash_sale_id: number | null } | undefined;
      if (order?.cash_sale_id) {
        await db.query(`DELETE FROM manual_sales WHERE id = $1`, [
          order.cash_sale_id,
        ]);
      }
      await db.query(
        `UPDATE orders SET payment_status = 'pendiente', payment_method = NULL, paid_at = NULL, cash_sale_id = NULL WHERE id = $1`,
        [id]
      );
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
// Si el pedido tenía una venta de caja asociada (estaba pagado), también
// elimina esa venta para no dejar un monto fantasma en el arqueo.
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
    const orderRows = await db.query(
      `SELECT cash_sale_id FROM orders WHERE id = $1`,
      [id]
    );
    const order = orderRows[0] as { cash_sale_id: number | null } | undefined;
    if (order?.cash_sale_id) {
      await db.query(`DELETE FROM manual_sales WHERE id = $1`, [
        order.cash_sale_id,
      ]);
    }
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
