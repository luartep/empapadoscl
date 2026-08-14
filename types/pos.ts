// ─── Productos ─────────────────────────────────────────────────
// Nota: se dejan campos opcionales adicionales vía index signature
// porque distintos componentes leen campos extra de forma defensiva
// (categoria, disponible, activo, imagen_url, descripcion, etc.)

export interface Producto {
  id: number
  nombre: string
  precio: number
  categoria?: string
  descripcion?: string | null
  imagen_url?: string | null
  disponible?: boolean
  activo?: boolean
  modificadores?: GrupoModificadorProducto[]
  grupos_modificadores?: GrupoModificadorProducto[]
  [key: string]: any
}

export interface GrupoModificadorProducto {
  id: number | string
  nombre: string
  obligatorio?: boolean
  seleccion_multiple?: boolean
  opciones: {
    id: number | string
    nombre: string
    precio_extra: number
  }[]
}

// ─── Carrito ───────────────────────────────────────────────────

export interface ModificadorSeleccionado {
  opcion_id: number | string
  opcion_nombre: string
  precio_extra: number
}

export interface ItemCarrito {
  uid: string
  producto_id: number
  producto_nombre: string
  precio_base: number
  cantidad: number
  modificadores: ModificadorSeleccionado[]
  precio_unitario: number
  precio_total: number
  notas: string
}

// ─── Pagos ─────────────────────────────────────────────────────

export type MetodoPago = 'efectivo' | 'debito' | 'transferencia' | 'mixto'

export interface PagoMixto {
  efectivo: number
  debito: number
  transferencia: number
}

// ─── Ventas ────────────────────────────────────────────────────

export interface Venta {
  id: number
  numero_orden?: string
  numero_correlativo?: string | number
  total: number
  subtotal?: number
  descuento_pct?: number
  descuento_monto?: number
  metodo_pago?: MetodoPago | string
  monto_efectivo?: number | null
  monto_debito?: number | null
  monto_transferencia?: number | null
  vuelto?: number
  tipo_orden?: string
  cliente_nombre?: string | null
  cliente_telefono?: string | null
  direccion_entrega?: string | null
  anulada?: boolean
  creado_en?: string | null
  created_at?: string | null
  [key: string]: any
}

// ─── Turnos de caja ────────────────────────────────────────────

export interface Turno {
  id: number
  cajero?: string
  fondo_inicial?: number
  fecha_apertura?: string | null
  fecha_cierre?: string | null
  notas?: string | null
  activo?: boolean
  [key: string]: any
}
