import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

// GET /api/inventory-movements?itemId=... — protegido. Historial de un insumo (últimos 50).
export async function GET(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const itemId = request.nextUrl.searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "Falta itemId." }, { status: 400 });
  }

  try {
    const db = sql();
    const movements = await db.query(
      `SELECT * FROM inventory_movements
       WHERE item_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [itemId]
    );
    return NextResponse.json({ movements });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo cargar el historial." },
      { status: 500 }
    );
  }
}

// POST /api/inventory-movements — protegido. Registra un movimiento de stock y
// actualiza la cantidad del insumo en la misma consulta (evita quedar desincronizado).
//
// type = 'entrada' → suma `quantity` al stock actual.
// type = 'salida'  → resta `quantity` al stock actual.
// type = 'ajuste'  → deja el stock exactamente en `quantity` (conteo físico).
export async function POST(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const { itemId, type, quantity, note = null } = body;

  if (!itemId || !type || quantity == null) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios (insumo, tipo, cantidad)." },
      { status: 400 }
    );
  }
  if (!["entrada", "salida", "ajuste"].includes(type)) {
    return NextResponse.json(
      { error: "type debe ser 'entrada', 'salida' o 'ajuste'." },
      { status: 400 }
    );
  }
  if (Number(quantity) < 0) {
    return NextResponse.json(
      { error: "La cantidad no puede ser negativa." },
      { status: 400 }
    );
  }

  try {
    const db = sql();
    const result = await db.query(
      `WITH updated AS (
         UPDATE inventory_items
         SET quantity = CASE
               WHEN $2 = 'entrada' THEN quantity + $3
               WHEN $2 = 'salida' THEN quantity - $3
               ELSE $3
             END,
             updated_at = now()
         WHERE id = $1
         RETURNING id, branch_id, quantity
       )
       INSERT INTO inventory_movements (item_id, branch_id, type, quantity, resulting_quantity, note)
       SELECT id, branch_id, $2, $3, quantity, $4 FROM updated
       RETURNING *`,
      [itemId, type, quantity, note]
    );

    if (result.length === 0) {
      return NextResponse.json(
        { error: "No se encontró el insumo." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, movement: result[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo registrar el movimiento." },
      { status: 500 }
    );
  }
}
