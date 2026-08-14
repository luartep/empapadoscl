'use client'

import { useMemo, useState } from 'react'
import type { MetodoPago, PagoMixto } from '@/types/pos'

interface Props {
  total: number
  onConfirmar: (metodo: MetodoPago, pagos: PagoMixto, vuelto: number) => void | Promise<void>
  onCerrar: () => void
}

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

const METODOS: { id: MetodoPago; label: string; icon: string }[] = [
  { id: 'efectivo', label: 'Efectivo', icon: '💵' },
  { id: 'debito', label: 'Débito', icon: '💳' },
  { id: 'transferencia', label: 'Transferencia', icon: '📱' },
  { id: 'mixto', label: 'Mixto', icon: '🔀' },
]

const MONTOS_RAPIDOS = [1000, 2000, 5000, 10000, 20000]

export default function ModalCobro({ total, onConfirmar, onCerrar }: Props) {
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [efectivo, setEfectivo] = useState<string>('')
  const [debito, setDebito] = useState<string>('')
  const [transferencia, setTransferencia] = useState<string>('')
  const [enviando, setEnviando] = useState(false)

  const num = (v: string) => Number(v.replace(/\D/g, '')) || 0

  const pagos: PagoMixto = useMemo(() => {
    if (metodo === 'efectivo') return { efectivo: num(efectivo) || total, debito: 0, transferencia: 0 } as PagoMixto
    if (metodo === 'debito') return { efectivo: 0, debito: total, transferencia: 0 } as PagoMixto
    if (metodo === 'transferencia') return { efectivo: 0, debito: 0, transferencia: total } as PagoMixto
    return { efectivo: num(efectivo), debito: num(debito), transferencia: num(transferencia) } as PagoMixto
  }, [metodo, efectivo, debito, transferencia, total])

  const sumaPagos = (pagos.efectivo || 0) + (pagos.debito || 0) + (pagos.transferencia || 0)
  const vuelto = metodo === 'efectivo' ? Math.max(0, num(efectivo) - total) : 0
  const faltante = metodo === 'mixto' ? Math.max(0, total - sumaPagos) : 0

  const puedeConfirmar =
    metodo === 'efectivo'
      ? (num(efectivo) === 0 || num(efectivo) >= total)
      : metodo === 'mixto'
      ? sumaPagos >= total
      : true

  const handleConfirmar = async () => {
    if (!puedeConfirmar || enviando) return
    setEnviando(true)
    try {
      await onConfirmar(metodo, pagos, vuelto)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400 mb-0.5">Cobrar</p>
            <h2 className="text-2xl font-black text-zinc-100 tabular-nums">{formatCLP(total)}</h2>
          </div>
          <button onClick={onCerrar} className="text-zinc-500 hover:text-zinc-300 p-1">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {/* Métodos de pago */}
          <div className="grid grid-cols-2 gap-2">
            {METODOS.map(m => (
              <button
                key={m.id}
                onClick={() => setMetodo(m.id)}
                className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold transition-colors ${
                  metodo === m.id
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                    : 'border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {/* Efectivo */}
          {metodo === 'efectivo' && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Monto recibido</label>
              <input
                type="text"
                inputMode="numeric"
                value={efectivo}
                onChange={e => setEfectivo(e.target.value)}
                placeholder={`${total}`}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-lg font-bold text-zinc-100 placeholder-zinc-600 outline-none focus:border-cyan-500 tabular-nums"
              />
              <div className="flex flex-wrap gap-1.5">
                {MONTOS_RAPIDOS.filter(m => m >= total).slice(0, 4).map(m => (
                  <button
                    key={m}
                    onClick={() => setEfectivo(String(m))}
                    className="rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-300 transition-colors"
                  >
                    {formatCLP(m)}
                  </button>
                ))}
                <button
                  onClick={() => setEfectivo(String(total))}
                  className="rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-600/40 px-2.5 py-1 text-xs font-semibold text-cyan-300 transition-colors"
                >
                  Exacto
                </button>
              </div>
              {num(efectivo) > 0 && num(efectivo) < total && (
                <p className="text-xs text-red-400">Falta {formatCLP(total - num(efectivo))}</p>
              )}
              {vuelto > 0 && (
                <div className="flex justify-between items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5">
                  <span className="text-sm font-semibold text-emerald-400">Vuelto</span>
                  <span className="text-lg font-black text-emerald-400 tabular-nums">{formatCLP(vuelto)}</span>
                </div>
              )}
            </div>
          )}

          {/* Débito / Transferencia: confirmación simple */}
          {(metodo === 'debito' || metodo === 'transferencia') && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 px-4 py-3 text-sm text-zinc-400">
              Se registrará {formatCLP(total)} como {metodo === 'debito' ? 'pago con débito' : 'transferencia'}.
            </div>
          )}

          {/* Mixto */}
          {metodo === 'mixto' && (
            <div className="flex flex-col gap-3">
              {[
                { label: 'Efectivo', icon: '💵', value: efectivo, set: setEfectivo },
                { label: 'Débito', icon: '💳', value: debito, set: setDebito },
                { label: 'Transferencia', icon: '📱', value: transferencia, set: setTransferencia },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3">
                  <span className="w-32 text-sm text-zinc-400 flex items-center gap-1.5">{f.icon} {f.label}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    placeholder="0"
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-bold text-zinc-100 placeholder-zinc-600 outline-none focus:border-cyan-500 tabular-nums"
                  />
                </div>
              ))}
              <div className="flex justify-between text-sm border-t border-zinc-800 pt-2">
                <span className="text-zinc-400">Suma ingresada</span>
                <span className={`font-mono font-bold ${sumaPagos >= total ? 'text-emerald-400' : 'text-zinc-200'}`}>
                  {formatCLP(sumaPagos)}
                </span>
              </div>
              {faltante > 0 && (
                <p className="text-xs text-red-400">Falta {formatCLP(faltante)} para cubrir el total</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-zinc-800 shrink-0">
          <button
            onClick={handleConfirmar}
            disabled={!puedeConfirmar || enviando}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-base font-black text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando ? 'Registrando...' : `Confirmar pago · ${formatCLP(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
