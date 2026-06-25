import { NextRequest, NextResponse } from "next/server";
import {
  checkCredentials,
  createSessionToken,
  ADMIN_COOKIE_NAME,
  ADMIN_COOKIE_MAX_AGE,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  let username: string;
  let password: string;
  try {
    const body = await request.json();
    username = body.username ?? "";
    password = body.password ?? "";
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const valid = checkCredentials(username, password);

  if (!valid) {
    return NextResponse.json(
      { error: "Usuario o clave incorrectos." },
      { status: 401 }
    );
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: ADMIN_COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}
