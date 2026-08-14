'use client'

import type { ItemCarrito } from '@/types/pos'
import type { DescuentoAplicado, DatosOrden, Descuento } from '@/types/pos-v3'
import SelectorTipoOrden from '@/components/pos/SelectorTipoOrden'
import PanelDescuentos from '@/components/pos/PanelDescuentos'

interface Props {
  items: ItemCarrito[]
  subtotal: number
  descuentoAplicado: DescuentoAplicado | null
  descuentoMonto: number
  total: number
  datosOrden: DatosOrden
  descuentosDisponibles: Descuento[]
  onCantidad: (uid: string, cantidad: number) => void
  onQuitar: (uid: string) => void
  onDescuento: (d: DescuentoAplicado | null) => void
  onDatosOrden: (d: DatosOrden) => void
  onCobrar: () => void
  onLimpiar: () => void
}

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

export default function PanelCarritoV3({
  items, subtotal, descuentoAplicado, descuentoMonto, total, datosOrden,
  descuentosDisponibles, onCantidad, onQuitar, onDescuento, onDatosOrden,
  onCobrar, onLimpiar,
}: Props) {
  const isEmpty = items.length === 0
  const esDelivery = datosOrden.tipo === 'delivery'

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">{esDelivery ? '🛵' : '🏪'}</span>
          <span className="font-bold text-zinc-100 text-sm">
            {esDelivery ? 'Delivery' : 'Retiro'}
          </span>
          {!isEmpty && (
            <span className="rounded-full bg-cyan-600 text-white text-xs font-bold px-2 py-0.5">
              {items.reduce((a, i) => a + i.cantidad, 0)}
            </span>
          )}
        </div>
        {!isEmpty && (
          <button onClick={onLimpiar} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
            Vaciar
          </button>
        )}
      </div>

      {/* Tipo de orden — siempre visible */}
      <div className="px-3 py-3 border-b border-zinc-800/60 shrink-0">
        <SelectorTipoOrden datos={datosOrden} onChange={onDatosOrden} />
      </div>

      {/* Ítems */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-700 gap-3">
            <span className="text-5xl">🍔</span>
            <p className="text-sm text-center">Agrega productos del menú</p>
          </div>
        ) : (
          items.map(item => (
            <div key={item.uid} className="group rounded-xl border border-zinc-800 bg-zinc-800/40 hover:border-zinc-700 transition-colors p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-100 truncate">{item.producto_nombre}</p>
                  {item.modificadores.length > 0 && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">
                      {item.modificadores.map(m => m.opcion_nombre).join(' · ')}
                    </p>
                  )}
                  {item.notas && (
                    <p className="text-xs text-amber-400/80 mt-0.5 truncate italic">📝 {item.notas}</p>
                  )}
                </div>
                <button
                  onClick={() => onQuitar(item.uid)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all text-sm shrink-0"
                >✕</button>
              </div>

              <div className="flex items-center justify-between mt-2.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onCantidad(item.uid, item.cantidad - 1)}
                    className="h-6 w-6 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-bold flex items-center justify-center transition-colors"
                  >−</button>
                  <span className="w-5 text-center text-sm font-bold text-zinc-100 tabular-nums">{item.cantidad}</span>
                  <button
                    onClick={() => onCantidad(item.uid, item.cantidad + 1)}
                    className="h-6 w-6 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-bold flex items-center justify-center transition-colors"
                  >+</button>
                </div>
                <span className="text-sm font-black text-zinc-100 tabular-nums">{formatCLP(item.precio_total)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Totales + descuentos + cobrar */}
      {!isEmpty && (
        <div className="px-3 py-3 border-t border-zinc-800 flex flex-col gap-3 shrink-0">

          {/* Descuentos */}
          <PanelDescuentos
            subtotal={subtotal}
            descuentos={descuentosDisponibles}
            aplicado={descuentoAplicado}
            onAplicar={onDescuento}
          />

          {/* Totales */}
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal</span>
              <span className="font-mono">{formatCLP(subtotal)}</span>
            </div>
            {descuentoMonto > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>Descuento</span>
                <span className="font-mono">−{formatCLP(descuentoMonto)}</span>
              </div>
            )}
            {esDelivery && (
              <div className="flex justify-between text-orange-400 text-xs">
                <span>🛵 Delivery</span>
                <span>coordinar con cliente</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center border-t border-zinc-800 pt-2">
            <span className="font-black text-zinc-100">Total</span>
            <span className="text-xl font-black text-cyan-400 tabular-nums font-mono">{formatCLP(total)}</span>
          </div>

          {/* Botón cobrar */}
          <button
            onClick={onCobrar}
            disabled={esDelivery && !datosOrden.cliente_nombre?.trim()}
            className={`w-full rounded-xl py-4 text-base font-black text-white transition-all active:scale-[0.98] shadow-lg disabled:opacity-40 disabled:cursor-not-allowed ${
              esDelivery
                ? 'bg-orange-500 hover:bg-orange-400 shadow-orange-900/30'
                : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/30'
            }`}
          >
            {esDelivery && !datosOrden.cliente_nombre?.trim()
              ? 'Ingresa nombre del cliente'
              : `Cobrar ${formatCLP(total)}`}
          </button>
        </div>
      )}
    </div>
  )
}
