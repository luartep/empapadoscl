import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

// GET /api/branches — protegido. Lista las sucursales disponibles.
export async function GET() {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const db = sql();
    const branches = await db.query(
      `SELECT * FROM branches WHERE active = true ORDER BY name ASC`
    );
    return NextResponse.json({ branches });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "No se pudieron cargar las sucursales." },
      { status: 500 }
    );
  }
}
