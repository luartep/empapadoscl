import { neon } from "@neondatabase/serverless";

/**
 * Conexión a la base de datos (Neon Postgres, integrado a Vercel).
 *
 * Requiere la variable de entorno DATABASE_URL configurada en Vercel
 * (Project Settings → Environment Variables) o en `.env.local` para
 * desarrollo local. Vercel la agrega automáticamente al conectar el
 * proyecto a una base de datos Postgres/Neon desde el dashboard.
 */
function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Falta la variable de entorno DATABASE_URL. Conecta una base de datos Postgres/Neon desde el dashboard de Vercel (Storage → Create Database) y la variable se agrega automáticamente."
    );
  }
  return neon(connectionString);
}

export const sql = getSql;
