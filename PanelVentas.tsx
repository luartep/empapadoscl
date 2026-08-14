'use client'

import { useState } from 'react'
import type { Venta, Turno } from '@/types/pos'

interface Props {
  ventas: Venta[]
  turno: Turno | null
  totalHoy: number
  ventasHoy: number
  onAnular: (id: number) => void | Promise<void>
  onCerrarTurno: () => void
}

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function formatHora(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

// Lectura defensiva de campos que pueden variar según el esquema real de Venta.
function campo<T = any>(v: Venta, key: string, fallback: T): T {
  const val = (v as any)?.[key]
  return val === undefined || val === null ? fallback : val
}

export default function PanelVentas({ ventas, turno, totalHoy, ventasHoy, onAnular, onCerrarTurno }: Props) {
  const [anulandoId, setAnulandoId] = useState<number | null>(null)

  const handleAnular = async (id: number) => {
    if (!confirm('¿Anular esta venta? Esta acción no se puede deshacer.')) return
    setAnulandoId(id)
    try {
      await onAnular(id)
    } finally {
      setAnulandoId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Resumen del turno */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">
              {turno ? `Turno #${turno.id} · ${(turno as any).cajero ?? ''}` : 'Sin turno activo'}
            </p>
            <h2 className="text-lg font-black text-zinc-100">Resumen del día</h2>
          </div>
          {turno && (
            <button
              onClick={onCerrarTurno}
              className="rounded-xl border border-zinc-700 bg-zinc-800 hover:border-red-500/40 hover:text-red-400 px-3 py-2 text-xs font-semibold text-zinc-400 transition-colors"
            >
              Cerrar turno
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3">
            <p className="text-xs text-zinc-500 mb-1">Ventas hoy</p>
            <p className="text-2xl font-black text-cyan-400 tabular-nums">{ventasHoy}</p>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
            <p className="text-xs text-zinc-500 mb-1">Total recaudado</p>
            <p className="text-2xl font-black text-emerald-400 tabular-nums">{formatCLP(totalHoy)}</p>
          </div>
        </div>
      </div>

      {/* Lista de ventas */}
      <div className="rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="bg-zinc-800/60 px-4 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Historial de ventas</p>
        </div>

        {ventas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-700 gap-2">
            <span className="text-4xl">📋</span>
            <p className="text-sm">Aún no hay ventas registradas</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {ventas.map(v => {
              const anulada = campo(v, 'anulada', false)
              const tipoOrden = campo<string>(v, 'tipo_orden', 'retiro')
              const metodo = campo<string>(v, 'metodo_pago', '')
              const numOrden = campo<string | number>(v, 'numero_correlativo', campo(v, 'numero_orden', v.id))
              const fecha = campo<string | null>(v, 'creado_en', campo(v, 'created_at', null))
              const cliente = campo<string | null>(v, 'cliente_nombre', null)

              return (
                <div
                  key={v.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${anulada ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg shrink-0">{tipoOrden === 'delivery' ? '🛵' : '🏪'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-zinc-100">#{numOrden}</p>
                        {anulada && (
                          <span className="rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 uppercase">
                            Anulada
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 truncate">
                        {formatHora(fecha)}{cliente ? ` · ${cliente}` : ''}{metodo ? ` · ${metodo}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-black text-zinc-100 tabular-nums">{formatCLP(v.total)}</span>
                    {!anulada && (
                      <button
                        onClick={() => handleAnular(v.id)}
                        disabled={anulandoId === v.id}
                        className="text-xs text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        {anulandoId === v.id ? '...' : 'Anular'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
