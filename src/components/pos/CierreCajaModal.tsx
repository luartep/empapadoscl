'use client'

import { useState, useEffect } from 'react'
import type { CierreCaja } from '@/types/pos-v3'
import type { Turno } from '@/types/pos'

interface Props {
  turno: Turno
  onCerrar: () => void
  onConfirmarCierre: (notas: string) => Promise<void>
}

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
  }).format(n)
}

function formatFecha(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function CierreCajaModal({ turno, onCerrar, onConfirmarCierre }: Props) {
  const [cierre, setCierre] = useState<CierreCaja | null>(null)
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmando, setConfirmando] = useState(false)
  const [confirmado, setConfirmado] = useState(false)

  useEffect(() => {
    fetch(`/api/cierre?turno_id=${turno.id}`)
      .then(r => r.json())
      .then(setCierre)
      .finally(() => setLoading(false))
  }, [turno.id])

  const handleConfirmar = async () => {
    setConfirmando(true)
    await onConfirmarCierre(notas)
    setConfirmado(true)
    setConfirmando(false)
  }

  const handleImprimir = () => window.print()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-0.5">
              Cierre de turno
            </p>
            <h2 className="text-xl font-black text-zinc-100">Resumen de caja</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Turno #{turno.id} · {turno.cajero}</p>
          </div>
          <div className="flex gap-2">
            {cierre && (
              <button
                onClick={handleImprimir}
                className="rounded-xl border border-zinc-600 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors flex items-center gap-1.5"
              >
                🖨️ Imprimir
              </button>
            )}
            {!confirmado && (
              <button onClick={onCerrar} className="text-zinc-500 hover:text-zinc-300 p-2">✕</button>
            )}
          </div>
        </div>

        {/* Contenido */}
        <div id="cierre-imprimible" className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
            </div>
          ) : cierre ? (
            <>
              {/* Info del turno */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-3">
                  <p className="text-xs text-zinc-500 mb-1">Apertura</p>
                  <p className="font-semibold text-zinc-200">{formatFecha(cierre.fecha_apertura)}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-3">
                  <p className="text-xs text-zinc-500 mb-1">Cierre</p>
                  <p className="font-semibold text-zinc-200">{formatFecha(new Date().toISOString())}</p>
                </div>
              </div>

              {/* KPIs principales */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Ventas', valor: cierre.cantidad_ventas, suffix: ' órdenes', color: 'text-cyan-400', bg: 'bg-cyan-400/8 border-cyan-400/20' },
                  { label: 'Neto recaudado', valor: formatCLP(cierre.total_neto), color: 'text-emerald-400', bg: 'bg-emerald-400/8 border-emerald-400/20' },
                  { label: 'Ticket promedio', valor: formatCLP(cierre.ticket_promedio), color: 'text-amber-400', bg: 'bg-amber-400/8 border-amber-400/20' },
                  { label: 'Descuentos', valor: formatCLP(cierre.total_descuentos), color: 'text-red-400', bg: 'bg-red-400/8 border-red-400/20' },
                ].map(k => (
                  <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">{k.label}</p>
                    <p className={`text-lg font-black tabular-nums ${k.color}`}>
                      {k.valor}{(k as any).suffix ?? ''}
                    </p>
                  </div>
                ))}
              </div>

              {/* Desglose por método de pago */}
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <div className="bg-zinc-800/60 px-4 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Desglose por método de pago</p>
                </div>
                <div className="px-4 py-3 flex flex-col gap-2 text-sm">
                  {[
                    { label: 'Efectivo', icon: '💵', valor: cierre.total_efectivo, color: 'text-emerald-400' },
                    { label: 'Débito', icon: '💳', valor: cierre.total_debito, color: 'text-cyan-400' },
                    { label: 'Transferencia', icon: '📱', valor: cierre.total_transferencia, color: 'text-purple-400' },
                  ].map(m => (
                    <div key={m.label} className="flex items-center justify-between py-1 border-b border-zinc-800/60 last:border-0">
                      <span className="flex items-center gap-2 text-zinc-400">
                        <span>{m.icon}</span>{m.label}
                      </span>
                      <span className={`font-mono font-bold ${m.color}`}>{formatCLP(m.valor)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-700 font-black">
                    <span className="text-zinc-200">Total en caja</span>
                    <span className="text-amber-400 font-mono text-lg">{formatCLP(cierre.fondo_mas_efectivo)}</span>
                  </div>
                  <p className="text-xs text-zinc-600">Fondo inicial ({formatCLP(cierre.fondo_inicial)}) + efectivo recibido</p>
                </div>
              </div>

              {/* Tipo de orden: retiro vs delivery */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Retiro en local', icon: '🏪', cant: cierre.cantidad_retiro, total: cierre.total_retiro, color: 'border-cyan-400/20 bg-cyan-400/5' },
                  { label: 'Delivery', icon: '🛵', cant: cierre.cantidad_delivery, total: cierre.total_delivery, color: 'border-orange-400/20 bg-orange-400/5' },
                ].map(t => (
                  <div key={t.label} className={`rounded-xl border p-4 ${t.color}`}>
                    <p className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                      <span>{t.icon}</span>{t.label}
                    </p>
                    <p className="text-2xl font-black text-zinc-100 mt-1 tabular-nums">{t.cant}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{formatCLP(t.total)}</p>
                  </div>
                ))}
              </div>

              {/* Top productos */}
              {cierre.top_productos.length > 0 && (
                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="bg-zinc-800/60 px-4 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Top productos del turno</p>
                  </div>
                  <div className="px-4 py-3">
                    {cierre.top_productos.map((p, i) => {
                      const maxCant = cierre.top_productos[0]?.cantidad || 1
                      return (
                        <div key={p.nombre} className="flex items-center gap-3 py-1.5">
                          <span className="w-5 text-right text-xs font-bold text-zinc-600 shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="text-sm text-zinc-200 truncate">{p.nombre}</span>
                              <span className="text-xs text-zinc-500 ml-2 shrink-0">{p.cantidad} und</span>
                            </div>
                            <div className="h-1 w-full rounded-full bg-zinc-800">
                              <div
                                className="h-1 rounded-full bg-cyan-500"
                                style={{ width: `${(p.cantidad / maxCant) * 100}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs font-mono text-zinc-400 shrink-0">{formatCLP(p.total)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Anuladas */}
              {cierre.ventas_anuladas > 0 && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                  <p className="text-sm text-red-400">
                    ⚠️ {cierre.ventas_anuladas} venta{cierre.ventas_anuladas > 1 ? 's' : ''} anulada{cierre.ventas_anuladas > 1 ? 's' : ''} en este turno
                  </p>
                </div>
              )}

              {/* Notas */}
              {!confirmado && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Notas de cierre (opcional)
                  </label>
                  <textarea
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    rows={2}
                    placeholder="Sin novedad, billetes para depósito..."
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-cyan-500 resize-none"
                  />
                </div>
              )}

              {/* Confirmado */}
              {confirmado && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-center">
                  <p className="text-2xl mb-2">✅</p>
                  <p className="font-bold text-emerald-400">Turno cerrado correctamente</p>
                  <p className="text-xs text-zinc-500 mt-1">Puedes imprimir este resumen antes de cerrar</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-sm text-zinc-500 py-10">Error al cargar el cierre</p>
          )}
        </div>

        {/* Footer */}
        {!confirmado && cierre && (
          <div className="flex gap-3 px-6 pb-6 pt-3 border-t border-zinc-800 shrink-0">
            <button
              onClick={onCerrar}
              className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-semibold text-zinc-400 hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={confirmando}
              className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50"
            >
              {confirmando ? 'Cerrando...' : '🔒 Confirmar cierre de turno'}
            </button>
          </div>
        )}

        {confirmado && (
          <div className="px-6 pb-6 pt-3 border-t border-zinc-800 shrink-0">
            <button
              onClick={onCerrar}
              className="w-full rounded-xl bg-zinc-700 hover:bg-zinc-600 py-2.5 text-sm font-semibold text-zinc-200 transition-colors"
            >
              Cerrar ventana
            </button>
          </div>
        )}
      </div>

      {/* CSS de impresión */}
      <style jsx global>{`
        @media print {
          body > *:not(#cierre-imprimible) { display: none !important; }
          #cierre-imprimible {
            overflow: visible !important;
            max-height: none !important;
            background: white !important;
            color: black !important;
            padding: 20px;
            font-size: 12px;
          }
          #cierre-imprimible * {
            color: black !important;
            border-color: #ddd !important;
            background: white !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  )
}
