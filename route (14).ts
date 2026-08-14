import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

// GET /api/inventory?branchId=... — protegido. Lista los insumos de inventario.
// Si no se pasa branchId, devuelve los de todas las sucursales.
export async function GET(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const branchId = request.nextUrl.searchParams.get("branchId");

  try {
    const db = sql();
    const items = branchId
      ? await db.query(
          `SELECT * FROM inventory_items
           WHERE branch_id = $1 AND active = true
           ORDER BY name ASC`,
          [branchId]
        )
      : await db.query(
          `SELECT * FROM inventory_items
           WHERE active = true
           ORDER BY branch_id ASC, name ASC`
        );
    return NextResponse.json({ items });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo cargar el inventario." },
      { status: 500 }
    );
  }
}

// POST /api/inventory — protegido. Crea un insumo nuevo para una sucursal.
export async function POST(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const {
    branchId,
    name,
    unit = "unidad",
    quantity = 0,
    minThreshold = 0,
    notes = null,
  } = body;

  if (!branchId || !name) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios (sucursal, nombre)." },
      { status: 400 }
    );
  }

  try {
    const db = sql();
    const result = await db.query(
      `INSERT INTO inventory_items (branch_id, name, unit, quantity, min_threshold, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [branchId, name, unit, quantity, minThreshold, notes]
    );
    return NextResponse.json({ ok: true, item: result[0] });
  } catch (err: any) {
    console.error(err);
    const message =
      err?.code === "23505"
        ? "Ya existe un insumo con ese nombre en esta sucursal."
        : "No se pudo crear el insumo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/inventory — protegido. Actualiza nombre/unidad/mínimo/notas de un insumo.
// (Para cambiar la cantidad usa /api/inventory-movements, que además deja historial.)
export async function PUT(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, unit, minThreshold, notes, active } = body;

  if (!id) {
    return NextResponse.json(
      { error: "Falta el ID del insumo a actualizar." },
      { status: 400 }
    );
  }

  try {
    const db = sql();
    const result = await db.query(
      `UPDATE inventory_items SET
        name = COALESCE($2, name),
        unit = COALESCE($3, unit),
        min_threshold = COALESCE($4, min_threshold),
        notes = COALESCE($5, notes),
        active = COALESCE($6, active),
        updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, name ?? null, unit ?? null, minThreshold ?? null, notes ?? null, active ?? null]
    );
    return NextResponse.json({ ok: true, item: result[0] });
  } catch (err: any) {
    console.error(err);
    const message =
      err?.code === "23505"
        ? "Ya existe un insumo con ese nombre en esta sucursal."
        : "No se pudo actualizar el insumo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/inventory?id=... — protegido. Elimina un insumo (y su historial de movimientos).
export async function DELETE(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Falta el ID del insumo a eliminar." },
      { status: 400 }
    );
  }

  try {
    const db = sql();
    await db.query(`DELETE FROM inventory_items WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo eliminar el insumo." },
      { status: 500 }
    );
  }
}
