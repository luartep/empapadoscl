import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

// GET /api/recipes?productId=... — protegido.
// Si se pasa productId, devuelve las líneas de receta de ese producto.
// Sin productId devuelve todas las recetas con info de producto.
export async function GET(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const productId = request.nextUrl.searchParams.get("productId");

  try {
    const db = sql();
    const rows = productId
      ? await db.query(
          `SELECT pr.*, p.name AS product_name
           FROM product_recipes pr
           JOIN products p ON p.id = pr.product_id
           WHERE pr.product_id = $1
           ORDER BY pr.item_name ASC`,
          [productId]
        )
      : await db.query(
          `SELECT pr.*, p.name AS product_name
           FROM product_recipes pr
           JOIN products p ON p.id = pr.product_id
           ORDER BY p.name ASC, pr.item_name ASC`
        );

    return NextResponse.json({ recipes: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudieron cargar las recetas." },
      { status: 500 }
    );
  }
}

// POST /api/recipes — protegido. Agrega una línea a la receta de un producto.
export async function POST(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const { productId, itemName, quantity } = body;

  if (!productId || !itemName || quantity == null) {
    return NextResponse.json(
      { error: "Faltan campos (productId, itemName, quantity)." },
      { status: 400 }
    );
  }

  if (Number(quantity) <= 0) {
    return NextResponse.json(
      { error: "La cantidad debe ser mayor que 0." },
      { status: 400 }
    );
  }

  try {
    const db = sql();
    const result = await db.query(
      `INSERT INTO product_recipes (product_id, item_name, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (product_id, item_name)
       DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()
       RETURNING *`,
      [productId, itemName.trim(), Number(quantity)]
    );
    return NextResponse.json({ ok: true, recipe: result[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo guardar la receta." },
      { status: 500 }
    );
  }
}

// DELETE /api/recipes?id=... — protegido. Elimina una línea de receta por su id.
export async function DELETE(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Falta el id de la línea de receta." },
      { status: 400 }
    );
  }

  try {
    const db = sql();
    await db.query(`DELETE FROM product_recipes WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo eliminar la línea de receta." },
      { status: 500 }
    );
  }
}
