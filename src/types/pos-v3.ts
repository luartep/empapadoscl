// ─── Tipo de orden ───────────────────────────────────────────

export type TipoOrden = 'retiro' | 'delivery'

export interface DatosOrden {
  tipo: TipoOrden
  cliente_nombre?: string
  cliente_telefono?: string
  direccion_entrega?: string
}

// ─── Descuentos ──────────────────────────────────────────────

export type TipoDescuento = 'porcentaje' | 'monto_fijo' | 'producto'

export interface Descuento {
  id: number
  nombre: string
  tipo: TipoDescuento
  valor: number
  codigo: string | null
  activo: boolean
  usos: number
  max_usos: number | null
  created_at: string
}

export interface DescuentoAplicado {
  descuento_id?: number
  nombre: string
  tipo: TipoDescuento
  valor: number
  monto_calculado: number  // monto real a descontar sobre el subtotal
}

// ─── Notificaciones ──────────────────────────────────────────

export type TipoNotificacion = 'orden_lista' | 'orden_demorada' | 'stock_bajo' | 'sistema'

export interface Notificacion {
  id: number
  tipo: TipoNotificacion
  titulo: string
  mensaje: string | null
  referencia: string | null
  leida: boolean
  created_at: string
}

// ─── Cierre de caja ──────────────────────────────────────────

export interface CierreCaja {
  turno_id: number
  cajero: string
  fecha_apertura: string
  fecha_cierre: string
  fondo_inicial: number
  // Ventas
  cantidad_ventas: number
  ventas_anuladas: number
  subtotal_bruto: number
  total_descuentos: number
  total_neto: number
  ticket_promedio: number
  // Por método
  total_efectivo: number
  total_debito: number
  total_transferencia: number
  // Por tipo de orden
  total_retiro: number
  total_delivery: number
  cantidad_retiro: number
  cantidad_delivery: number
  // Caja física
  fondo_mas_efectivo: number
  // Top productos del turno
  top_productos: { nombre: string; cantidad: number; total: number }[]
}
