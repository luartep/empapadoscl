import { neon } from '@neondatabase/serverless'
import type {
  Descuento, Notificacion, CierreCaja, DatosOrden,
} from '@/types/pos-v3'

const sql = neon(process.env.DATABASE_URL!)

// ─── DESCUENTOS ──────────────────────────────────────────────

export async function getDescuentos(): Promise<Descuento[]> {
  const rows = await sql`
    SELECT * FROM descuentos WHERE activo = TRUE ORDER BY tipo, nombre
  `
  return rows as Descuento[]
}

export async function buscarDescuentoPorCodigo(codigo: string): Promise<Descuento | null> {
  const rows = await sql`
    SELECT * FROM descuentos
    WHERE codigo = ${codigo.toUpperCase().trim()}
      AND activo = TRUE
      AND (max_usos IS NULL OR usos < max_usos)
  `
  return rows[0] as Descuento ?? null
}

export async function registrarUsoDescuento(id: number): Promise<void> {
  await sql`UPDATE descuentos SET usos = usos + 1 WHERE id = ${id}`
}

export async function crearDescuento(data: Omit<Descuento, 'id' | 'usos' | 'created_at'>): Promise<Descuento> {
  const [row] = await sql`
    INSERT INTO descuentos (nombre, tipo, valor, codigo, activo, max_usos)
    VALUES (
      ${data.nombre}, ${data.tipo}, ${data.valor},
      ${data.codigo ? data.codigo.toUpperCase() : null},
      ${data.activo}, ${data.max_usos ?? null}
    )
    RETURNING *
  `
  return row as Descuento
}

export async function toggleDescuento(id: number): Promise<void> {
  await sql`UPDATE descuentos SET activo = NOT activo WHERE id = ${id}`
}

export async function eliminarDescuento(id: number): Promise<void> {
  await sql`DELETE FROM descuentos WHERE id = ${id}`
}

// ─── NOTIFICACIONES ──────────────────────────────────────────

export async function getNotificaciones(soloNoLeidas = false): Promise<Notificacion[]> {
  const rows = soloNoLeidas
    ? await sql`
        SELECT * FROM notificaciones
        WHERE leida = FALSE
        ORDER BY created_at DESC
        LIMIT 50
      `
    : await sql`
        SELECT * FROM notificaciones
        ORDER BY created_at DESC
        LIMIT 100
      `
  return rows as Notificacion[]
}

export async function crearNotificacion(data: {
  tipo: Notificacion['tipo']
  titulo: string
  mensaje?: string
  referencia?: string
}): Promise<Notificacion> {
  const [row] = await sql`
    INSERT INTO notificaciones (tipo, titulo, mensaje, referencia)
    VALUES (${data.tipo}, ${data.titulo}, ${data.mensaje ?? null}, ${data.referencia ?? null})
    RETURNING *
  `
  return row as Notificacion
}

export async function marcarNotificacionesLeidas(ids?: number[]): Promise<void> {
  if (ids && ids.length > 0) {
    await sql`UPDATE notificaciones SET leida = TRUE WHERE id = ANY(${ids})`
  } else {
    await sql`UPDATE notificaciones SET leida = TRUE WHERE leida = FALSE`
  }
}

// ─── CIERRE DE CAJA ──────────────────────────────────────────

export async function generarCierreCaja(turno_id: number): Promise<CierreCaja> {
  const [turno] = await sql`SELECT * FROM turnos WHERE id = ${turno_id}`
  if (!turno) throw new Error('Turno no encontrado')

  const [stats] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE estado = 'completada')::int                          AS cantidad_ventas,
      COUNT(*) FILTER (WHERE estado = 'anulada')::int                             AS ventas_anuladas,
      COALESCE(SUM(subtotal)       FILTER (WHERE estado = 'completada'), 0)::numeric AS subtotal_bruto,
      COALESCE(SUM(descuento_monto) FILTER (WHERE estado = 'completada'), 0)::numeric AS total_descuentos,
      COALESCE(SUM(total)          FILTER (WHERE estado = 'completada'), 0)::numeric AS total_neto,
      COALESCE(SUM(monto_efectivo) FILTER (WHERE estado = 'completada'), 0)::numeric AS total_efectivo,
      COALESCE(SUM(monto_debito)   FILTER (WHERE estado = 'completada'), 0)::numeric AS total_debito,
      COALESCE(SUM(monto_transferencia) FILTER (WHERE estado = 'completada'), 0)::numeric AS total_transferencia,
      COUNT(*) FILTER (WHERE estado = 'completada' AND tipo_orden = 'retiro')::int  AS cantidad_retiro,
      COUNT(*) FILTER (WHERE estado = 'completada' AND tipo_orden = 'delivery')::int AS cantidad_delivery,
      COALESCE(SUM(total) FILTER (WHERE estado = 'completada' AND tipo_orden = 'retiro'), 0)::numeric  AS total_retiro,
      COALESCE(SUM(total) FILTER (WHERE estado = 'completada' AND tipo_orden = 'delivery'), 0)::numeric AS total_delivery
    FROM ventas
    WHERE turno_id = ${turno_id}
  `

  const topProductos = await sql`
    SELECT
      lv.producto_nombre AS nombre,
      SUM(lv.cantidad)::int AS cantidad,
      SUM(lv.precio_total)::numeric AS total
    FROM lineas_venta lv
    JOIN ventas v ON v.id = lv.venta_id
    WHERE v.turno_id = ${turno_id} AND v.estado = 'completada'
    GROUP BY lv.producto_nombre
    ORDER BY cantidad DESC
    LIMIT 8
  `

  const cantidad = Number(stats.cantidad_ventas)
  const totalNeto = Number(stats.total_neto)

  return {
    turno_id,
    cajero: turno.cajero,
    fecha_apertura: turno.abierto_at,
    fecha_cierre: turno.cerrado_at ?? new Date().toISOString(),
    fondo_inicial: Number(turno.fondo_inicial),
    cantidad_ventas: cantidad,
    ventas_anuladas: Number(stats.ventas_anuladas),
    subtotal_bruto: Number(stats.subtotal_bruto),
    total_descuentos: Number(stats.total_descuentos),
    total_neto: totalNeto,
    ticket_promedio: cantidad > 0 ? Math.round(totalNeto / cantidad) : 0,
    total_efectivo: Number(stats.total_efectivo),
    total_debito: Number(stats.total_debito),
    total_transferencia: Number(stats.total_transferencia),
    cantidad_retiro: Number(stats.cantidad_retiro),
    cantidad_delivery: Number(stats.cantidad_delivery),
    total_retiro: Number(stats.total_retiro),
    total_delivery: Number(stats.total_delivery),
    fondo_mas_efectivo: Number(turno.fondo_inicial) + Number(stats.total_efectivo),
    top_productos: topProductos.map((p: any) => ({
      nombre: p.nombre,
      cantidad: Number(p.cantidad),
      total: Number(p.total),
    })),
  }
}
