'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Producto, MetodoPago, PagoMixto, Venta, Turno } from '@/types/pos'
import type { Descuento } from '@/types/pos-v3'
import { useCarritoV3 } from '@/lib/useCarritoV3'
import GridProductos from '@/components/pos/GridProductos'
import PanelCarritoV3 from '@/components/pos/PanelCarritoV3'
import ModalModificadores from '@/components/pos/ModalModificadores'
import ModalCobro from '@/components/pos/ModalCobro'
import ReciboVentaV3 from '@/components/pos/ReciboVentaV3'
import PanelVentas from '@/components/pos/PanelVentas'
import ModalAbrirTurno from '@/components/pos/ModalAbrirTurno'
import CierreCajaModal from '@/components/pos/CierreCajaModal'
import BadgeNotificaciones from '@/components/shared/BadgeNotificaciones'

type Vista = 'pos' | 'ventas'

export default function POSClientV3() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [descuentos, setDescuentos] = useState<Descuento[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [turno, setTurno] = useState<Turno | null>(null)
  const [totalHoy, setTotalHoy] = useState(0)
  const [ventasHoy, setVentasHoy] = useState(0)
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<Vista>('pos')

  // Modales
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null)
  const [mostrarCobro, setMostrarCobro] = useState(false)
  const [mostrarCierre, setMostrarCierre] = useState(false)
  const [ultimaVenta, setUltimaVenta] = useState<any | null>(null)

  const carrito = useCarritoV3()

  // ─── Carga inicial ────────────────────────────────────────

  const cargarDatos = useCallback(async () => {
    try {
      const [prodRes, resumenRes, ventasRes, descRes] = await Promise.all([
        fetch('/api/pos/productos'),
        fetch('/api/ventas?resumen=1'),
        fetch('/api/ventas'),
        fetch('/api/pos/descuentos'),
      ])
      const [prods, resumen, vts, descs] = await Promise.all([
        prodRes.json(), resumenRes.json(), ventasRes.json(), descRes.json(),
      ])
      setProductos(Array.isArray(prods) ? prods : [])
      setDescuentos(Array.isArray(descs) ? descs : [])
      setTurno(resumen.turno_activo ?? null)
      setTotalHoy(Number(resumen.total_hoy) || 0)
      setVentasHoy(Number(resumen.ventas_hoy) || 0)
      setVentas(Array.isArray(vts) ? vts : [])
    } catch (err) {
      console.error('Error cargando POS v3:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ─── Turno ───────────────────────────────────────────────

  const handleAbrirTurno = async (cajero: string, fondoInicial: number) => {
    await fetch('/api/pos/turno', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'abrir', cajero, fondo_inicial: fondoInicial }),
    })
    await cargarDatos()
  }

  const handleCerrarTurno = async (notas: string) => {
    if (!turno) return
    await fetch('/api/pos/turno', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'cerrar', turno_id: turno.id, notas }),
    })
    setMostrarCierre(false)
    await cargarDatos()
  }

  // ─── Cobro ───────────────────────────────────────────────

  const handleConfirmarCobro = async (metodo: MetodoPago, pagos: PagoMixto, vuelto: number) => {
    const body = {
      items: carrito.items,
      subtotal: carrito.subtotal,
      descuento_pct: carrito.descuentoAplicado?.tipo === 'porcentaje' ? carrito.descuentoAplicado.valor : 0,
      descuento_monto: carrito.descuentoMonto,
      total: carrito.total,
      metodo_pago: metodo,
      monto_efectivo: pagos.efectivo || null,
      monto_debito: pagos.debito || null,
      monto_transferencia: pagos.transferencia || null,
      vuelto,
      // v3 extras
      tipo_orden: carrito.datosOrden.tipo,
      cliente_nombre: carrito.datosOrden.cliente_nombre || null,
      cliente_telefono: carrito.datosOrden.cliente_telefono || null,
      direccion_entrega: carrito.datosOrden.direccion_entrega || null,
    }

    const res = await fetch('/api/ventas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Error al registrar venta')
    const venta = await res.json()

    // Crear comanda en cocina
    try {
      await fetch('/api/pos/comandas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venta_id: venta.id, numero_orden: venta.numero_orden }),
      })
    } catch { /* silencioso si no hay módulo de cocina */ }

    // Registrar uso de descuento
    if (carrito.descuentoAplicado?.descuento_id) {
      try {
        await fetch('/api/pos/descuentos/uso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ descuento_id: carrito.descuentoAplicado.descuento_id }),
        })
      } catch { /* silencioso */ }
    }

    setUltimaVenta({
      numero_orden: venta.numero_orden,
      numero_correlativo: venta.numero_correlativo,
      items: carrito.items,
      subtotal: carrito.subtotal,
      descuentoAplicado: carrito.descuentoAplicado,
      descuentoMonto: carrito.descuentoMonto,
      total: carrito.total,
      metodo,
      pagos,
      vuelto,
      datosOrden: carrito.datosOrden,
    })

    setMostrarCobro(false)
    carrito.limpiar()
    await cargarDatos()
  }

  const handleAnular = async (id: number) => {
    await fetch(`/api/ventas?id=${id}&accion=anular`, { method: 'PATCH' })
    await cargarDatos()
  }

  // ─── Render ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <div className="h-10 w-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
          <span className="text-sm">Cargando POS...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 overflow-hidden">

      {/* Top bar mejorada */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-2">
          <span className="text-xl">🍔</span>
          <div className="leading-tight hidden sm:block">
            <span className="font-black text-zinc-100 text-sm tracking-wide">EMPAPADOS</span>
            <span className="ml-1.5 text-xs text-zinc-600">POS v3</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-800/60 p-1">
          {([
            { id: 'pos',    label: '🛒 Caja' },
            { id: 'ventas', label: '📋 Historial' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setVista(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                vista === tab.id
                  ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Turno + notificaciones + cierre */}
        <div className="flex items-center gap-2">
          {/* KPI rápido */}
          {turno && (
            <div className="hidden md:flex items-center gap-3 text-xs text-zinc-500 border border-zinc-800 rounded-lg px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{ventasHoy} ventas hoy</span>
              <span className="text-zinc-700">·</span>
              <span className="text-emerald-400 font-semibold">
                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totalHoy)}
              </span>
            </div>
          )}

          <BadgeNotificaciones />

          {turno && (
            <button
              onClick={() => setMostrarCierre(true)}
              className="rounded-xl border border-zinc-700 bg-zinc-800 hover:border-red-500/40 hover:text-red-400 px-3 py-2 text-xs font-semibold text-zinc-400 transition-colors"
            >
              Cerrar turno
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      {vista === 'pos' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Productos */}
          <div className="flex-1 overflow-hidden p-4">
            <GridProductos
              productos={productos}
              onSeleccionar={setProductoSeleccionado}
            />
          </div>

          {/* Carrito v3 */}
          <div className="w-80 xl:w-96 shrink-0 overflow-hidden">
            <PanelCarritoV3
              items={carrito.items}
              subtotal={carrito.subtotal}
              descuentoAplicado={carrito.descuentoAplicado}
              descuentoMonto={carrito.descuentoMonto}
              total={carrito.total}
              datosOrden={carrito.datosOrden}
              descuentosDisponibles={descuentos}
              onCantidad={carrito.setCantidad}
              onQuitar={carrito.quitarItem}
              onDescuento={carrito.aplicarDescuento}
              onDatosOrden={carrito.setDatosOrden}
              onCobrar={() => setMostrarCobro(true)}
              onLimpiar={carrito.limpiar}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto">
            <PanelVentas
              ventas={ventas}
              turno={turno}
              totalHoy={totalHoy}
              ventasHoy={ventasHoy}
              onAnular={handleAnular}
              onCerrarTurno={() => setMostrarCierre(true)}
            />
          </div>
        </div>
      )}

      {/* ─── Modales ─── */}

      {!turno && !loading && (
        <ModalAbrirTurno onAbrir={handleAbrirTurno} />
      )}

      {productoSeleccionado && (
        <ModalModificadores
          producto={productoSeleccionado}
          onConfirmar={(mods, notas) => {
            carrito.agregarItem(productoSeleccionado, mods, notas)
            setProductoSeleccionado(null)
          }}
          onCerrar={() => setProductoSeleccionado(null)}
        />
      )}

      {mostrarCobro && !carrito.isEmpty && (
        <ModalCobro
          total={carrito.total}
          onConfirmar={handleConfirmarCobro}
          onCerrar={() => setMostrarCobro(false)}
        />
      )}

      {mostrarCierre && turno && (
        <CierreCajaModal
          turno={turno}
          onCerrar={() => setMostrarCierre(false)}
          onConfirmarCierre={handleCerrarTurno}
        />
      )}

      {ultimaVenta && (
        <ReciboVentaV3
          venta={ultimaVenta}
          onNuevaVenta={() => setUltimaVenta(null)}
        />
      )}
    </div>
  )
}
