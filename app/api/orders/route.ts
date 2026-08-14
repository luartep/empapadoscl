import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

// POST /api/orders — público (clientes WhatsApp) y protegido (venta en caja).
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    customerName,
    orderType,
    address = null,
    pickupLocation = null,
    items,
    total,
    branchId: explicitBranchId,
  } = body;

  if (!customerName || !orderType || !items || total == null) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios del pedido." },
      { status: 400 }
    );
  }

  let branchId: string | null = null;
  if (explicitBranchId) {
    branchId = explicitBranchId;
  } else if (orderType === "retiro") {
    branchId = pickupLocation;
  }

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

    // ── Descontar inventario según receta ──────────────────────────────────
    // Solo si hay una sucursal definida y hay items en el pedido.
    if (branchId && Array.isArray(items) && items.length > 0) {
      try {
        // Recopilar product_ids del pedido (cada item tiene item.id o item.productId)
        const productIds: string[] = items
          .map((i: { item?: { id?: string }; productId?: string }) =>
            i?.item?.id ?? i?.productId ?? null
          )
          .filter(Boolean) as string[];

        if (productIds.length > 0) {
          // Traer todas las recetas de los productos del pedido
          const recipes = (await db.query(
            `SELECT pr.product_id, pr.item_name, pr.quantity
             FROM product_recipes pr
             WHERE pr.product_id = ANY($1::text[])`,
            [productIds]
          )) as { product_id: string; item_name: string; quantity: string }[];

          if (recipes.length > 0) {
            // Acumular consumos totales por nombre de insumo
            // (multiplicado por la cantidad de ese producto en el pedido)
            const consumo: Record<string, number> = {};

            for (const orderItem of items as {
              item?: { id?: string };
              productId?: string;
              qty?: number;
              quantity?: number;
            }[]) {
              const pid = orderItem?.item?.id ?? orderItem?.productId;
              const qty = Number(orderItem?.qty ?? orderItem?.quantity ?? 1);
              if (!pid) continue;

              for (const recipe of recipes.filter(
                (r) => r.product_id === pid
              )) {
                const key = recipe.item_name;
                consumo[key] = (consumo[key] ?? 0) + Number(recipe.quantity) * qty;
              }
            }

            // Descontar cada insumo en el inventario de la sucursal
            for (const [itemName, totalQty] of Object.entries(consumo)) {
              try {
                // Buscar el insumo en la sucursal por nombre
                const itemRows = (await db.query(
                  `SELECT id, quantity FROM inventory_items
                   WHERE branch_id = $1 AND name = $2 AND active = true
                   LIMIT 1`,
                  [branchId, itemName]
                )) as { id: number; quantity: string }[];

                if (itemRows.length === 0) continue; // insumo no existe en esta sucursal → saltar

                const invItem = itemRows[0];
                const currentQty = Number(invItem.quantity);
                const newQty = Math.max(0, currentQty - totalQty); // no baja de 0

                await db.query(
                  `UPDATE inventory_items
                   SET quantity = $2, updated_at = now()
                   WHERE id = $1`,
                  [invItem.id, newQty]
                );

                // Registrar el movimiento en el historial
                await db.query(
                  `INSERT INTO inventory_movements
                     (item_id, branch_id, type, quantity, resulting_quantity, note)
                   VALUES ($1, $2, 'salida', $3, $4, $5)`,
                  [
                    invItem.id,
                    branchId,
                    totalQty,
                    newQty,
                    `Pedido #${id} (automático)`,
                  ]
                );
              } catch (innerErr) {
                // No interrumpir el pedido si falla el descuento de un insumo
                console.error(
                  `[inventory] Error descontando "${itemName}":`,
                  innerErr
                );
              }
            }
          }
        }
      } catch (invErr) {
        // El pedido ya fue guardado; no revertir por un error de inventario
        console.error("[inventory] Error al procesar recetas:", invErr);
      }
    }
    // ── Fin descuento inventario ───────────────────────────────────────────

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo guardar el pedido en el panel." },
      { status: 500 }
    );
  }
}

// GET /api/orders — protegido.
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

// PATCH /api/orders — protegido. Soporta:
//   - prepStatus, branchId, markPaid, unmarkPaid, status (legado)
//   - acceptOrder: true → marca el pedido como aceptado
//   - cancelOrder: { reason: string } → cancela el pedido con motivo (no lo elimina)
export async function PATCH(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const { id, prepStatus, branchId, markPaid, unmarkPaid, status, acceptOrder, cancelOrder } = body;

  if (!id) {
    return NextResponse.json({ error: "Falta el id." }, { status: 400 });
  }

  try {
    const db = sql();

    // --- Compatibilidad con campo viejo "status" ---
    if (status != null && prepStatus == null) {
      await db.query(`UPDATE orders SET status = $2 WHERE id = $1`, [id, status]);
    }

    if (prepStatus != null) {
      await db.query(`UPDATE orders SET prep_status = $2 WHERE id = $1`, [id, prepStatus]);
    }

    if (branchId !== undefined) {
      await db.query(`UPDATE orders SET branch_id = $2 WHERE id = $1`, [id, branchId]);
    }

    // --- Aceptar pedido ---
    if (acceptOrder) {
      await db.query(`UPDATE orders SET accepted = true WHERE id = $1`, [id]);
    }

    // --- Cancelar pedido (soft delete: queda en BD con status='cancelado') ---
    if (cancelOrder) {
      const { reason } = cancelOrder;
      if (!reason || !reason.trim()) {
        return NextResponse.json({ error: "Falta el motivo de cancelación." }, { status: 400 });
      }
      // Si tenía venta de caja, la revertimos también
      const orderRows = await db.query(
        `SELECT cash_sale_id, payment_status FROM orders WHERE id = $1`,
        [id]
      );
      const order = orderRows[0] as { cash_sale_id: number | null; payment_status: string } | undefined;
      if (order?.cash_sale_id) {
        await db.query(`DELETE FROM manual_sales WHERE id = $1`, [order.cash_sale_id]);
      }
      await db.query(
        `UPDATE orders SET
          status = 'cancelado',
          cancel_reason = $2,
          payment_status = 'pendiente',
          payment_method = NULL,
          paid_at = NULL,
          cash_sale_id = NULL
         WHERE id = $1`,
        [id, reason.trim()]
      );
    }

    // --- Marcar como pagado ---
    if (markPaid) {
      const { paymentMethod } = markPaid;
      if (!paymentMethod) {
        return NextResponse.json({ error: "Falta el medio de pago." }, { status: 400 });
      }

      const orderRows = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
      const order = orderRows[0] as
        | {
            id: number;
            branch_id: string | null;
            total: number;
            customer_name: string;
            payment_status: string;
            cash_sale_id: number | null;
            status: string;
          }
        | undefined;

      if (!order) {
        return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
      }
      if (order.status === "cancelado") {
        return NextResponse.json({ error: "No se puede cobrar un pedido cancelado." }, { status: 400 });
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

      if (order.cash_sale_id) {
        await db.query(`DELETE FROM manual_sales WHERE id = $1`, [order.cash_sale_id]);
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
        await db.query(`DELETE FROM manual_sales WHERE id = $1`, [order.cash_sale_id]);
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
      await db.query(`DELETE FROM manual_sales WHERE id = $1`, [order.cash_sale_id]);
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
