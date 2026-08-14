import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

type ProductRow = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string | null;
  allows_extras: boolean;
  restricted_to_salvador_allende: boolean;
  modifier_groups: unknown;
  sort_order: number;
  active: boolean;
};

/** Convierte una fila de la tabla `products` (snake_case) al formato que espera el frontend (camelCase). */
function toMenuItem(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    category: row.category,
    image: row.image ?? undefined,
    allowsExtras: row.allows_extras,
    restrictedToSalvadorAllende: row.restricted_to_salvador_allende,
    modifierGroups: row.modifier_groups,
    sortOrder: row.sort_order,
    active: row.active,
  };
}

// GET /api/products — público, usado por el menú para listar productos y categorías.
export async function GET() {
  try {
    const db = sql();
    const products = (await db.query(
      `SELECT * FROM products WHERE active = true ORDER BY sort_order ASC`
    )) as unknown as ProductRow[];
    const categories = await db.query(
      `SELECT id, label FROM categories ORDER BY sort_order ASC`
    );

    return NextResponse.json({
      categories,
      menuData: products.map(toMenuItem),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo cargar el menú desde la base de datos." },
      { status: 500 }
    );
  }
}

// POST /api/products — protegido, crea un producto nuevo (usado por el panel).
export async function POST(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const {
    id,
    name,
    description = "",
    price,
    category,
    image = null,
    allowsExtras = false,
    restrictedToSalvadorAllende = false,
    modifierGroups = [],
  } = body;

  if (!id || !name || price == null || !category) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios (id, nombre, precio, categoría)." },
      { status: 400 }
    );
  }

  try {
    const db = sql();
    const maxOrderResult = await db.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM products`
    );
    const nextOrder = (maxOrderResult[0] as { next_order: number })
      .next_order;

    await db.query(
      `INSERT INTO products
        (id, name, description, price, category, image, allows_extras, restricted_to_salvador_allende, modifier_groups, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        name,
        description,
        price,
        category,
        image,
        allowsExtras,
        restrictedToSalvadorAllende,
        JSON.stringify(modifierGroups),
        nextOrder,
      ]
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    const message =
      err?.code === "23505"
        ? "Ya existe un producto con ese ID. Usa uno distinto."
        : "No se pudo crear el producto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/products — protegido, actualiza un producto existente.
export async function PUT(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const {
    id,
    name,
    description,
    price,
    category,
    image,
    allowsExtras,
    restrictedToSalvadorAllende,
    modifierGroups,
    active,
  } = body;

  if (!id) {
    return NextResponse.json(
      { error: "Falta el ID del producto a actualizar." },
      { status: 400 }
    );
  }

  try {
    const db = sql();
    await db.query(
      `UPDATE products SET
        name = $2,
        description = $3,
        price = $4,
        category = $5,
        image = $6,
        allows_extras = $7,
        restricted_to_salvador_allende = $8,
        modifier_groups = $9,
        active = $10,
        updated_at = now()
       WHERE id = $1`,
      [
        id,
        name,
        description,
        price,
        category,
        image,
        allowsExtras,
        restrictedToSalvadorAllende,
        JSON.stringify(modifierGroups),
        active ?? true,
      ]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo actualizar el producto." },
      { status: 500 }
    );
  }
}

// DELETE /api/products?id=... — protegido, elimina un producto.
export async function DELETE(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Falta el ID del producto a eliminar." },
      { status: 400 }
    );
  }

  try {
    const db = sql();
    await db.query(`DELETE FROM products WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo eliminar el producto." },
      { status: 500 }
    );
  }
}
