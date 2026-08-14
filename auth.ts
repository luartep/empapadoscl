import { cookies } from "next/headers";

/**
 * Autenticación simple por usuario + clave para el panel de administración.
 *
 * No hay tabla de usuarios en la base de datos: una sola credencial fija
 * protege todo el panel. Por defecto es usuario "gino" / clave "gino123".
 * Se puede cambiar sin tocar código agregando las variables de entorno
 * ADMIN_USERNAME y ADMIN_PASSWORD en Vercel (Project Settings →
 * Environment Variables); si no se configuran, se usan los valores por
 * defecto de abajo.
 *
 * Al validar la credencial correctamente, se guarda una cookie firmada
 * (HMAC-SHA256 vía Web Crypto) para no tener que reescribir usuario/clave
 * en cada visita. La firma evita que alguien fabrique la cookie sin
 * conocer la clave real.
 *
 * Se usa Web Crypto (no el módulo `crypto` de Node) porque este archivo se
 * importa tanto desde API routes (Node runtime) como desde middleware.ts
 * (Edge runtime), y Web Crypto es el único que funciona en ambos.
 */

const COOKIE_NAME = "empapados_admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 días

const DEFAULT_USERNAME = "gino";
const DEFAULT_PASSWORD = "gino123";

function getCredentials(): { username: string; password: string } {
  return {
    username: process.env.ADMIN_USERNAME || DEFAULT_USERNAME,
    password: process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD,
  };
}

/** Usado para firmar la cookie de sesión: combina usuario+clave en un solo secreto. */
function getSigningSecret(): string {
  const { username, password } = getCredentials();
  return `${username}:${password}`;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function importKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toHex(signature);
}

/** Comparación en tiempo constante para strings (evita timing attacks triviales). */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** Genera el valor de la cookie de sesión tras un login correcto. */
export async function createSessionToken(): Promise<string> {
  const secret = getSigningSecret();
  const issuedAt = Date.now().toString();
  const signature = await sign(issuedAt, secret);
  return `${issuedAt}.${signature}`;
}

/** Verifica si el usuario y clave ingresados coinciden con las credenciales configuradas. */
export function checkCredentials(username: string, password: string): boolean {
  const creds = getCredentials();
  const userOk = constantTimeEqual(username, creds.username);
  const passOk = constantTimeEqual(password, creds.password);
  return userOk && passOk;
}

/** Verifica si la cookie de sesión actual es válida y no expiró. */
export async function isValidSession(
  token: string | undefined
): Promise<boolean> {
  if (!token) return false;
  const [issuedAtStr, signature] = token.split(".");
  if (!issuedAtStr || !signature) return false;

  const secret = getSigningSecret();
  const expected = await sign(issuedAtStr, secret);
  if (!constantTimeEqual(expected, signature)) return false;

  const issuedAt = Number(issuedAtStr);
  if (Number.isNaN(issuedAt)) return false;

  const ageSeconds = (Date.now() - issuedAt) / 1000;
  return ageSeconds < SESSION_DURATION_SECONDS;
}

/** Lee y valida la sesión desde las cookies de la request (uso en API routes / Server Components). */
export async function getSessionFromCookies(): Promise<boolean> {
  const token = cookies().get(COOKIE_NAME)?.value;
  return isValidSession(token);
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_COOKIE_MAX_AGE = SESSION_DURATION_SECONDS;
