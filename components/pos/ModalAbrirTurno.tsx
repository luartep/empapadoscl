'use client'

import { useState } from 'react'

interface Props {
  onAbrir: (cajero: string, fondoInicial: number) => void | Promise<void>
}

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

const FONDOS_RAPIDOS = [10000, 20000, 30000, 50000]

export default function ModalAbrirTurno({ onAbrir }: Props) {
  const [cajero, setCajero] = useState('')
  const [fondo, setFondo] = useState('')
  const [enviando, setEnviando] = useState(false)

  const fondoNumero = Number(fondo.replace(/\D/g, '')) || 0
  const puedeAbrir = cajero.trim().length > 0

  const handleAbrir = async () => {
    if (!puedeAbrir || enviando) return
    setEnviando(true)
    try {
      await onAbrir(cajero.trim(), fondoNumero)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">

        {/* Header */}
        <div className="px-6 py-6 text-center border-b border-zinc-800">
          <span className="text-4xl">🔓</span>
          <h2 className="text-xl font-black text-zinc-100 mt-2">Abrir turno de caja</h2>
          <p className="text-sm text-zinc-500 mt-1">Ingresa tus datos para comenzar a vender</p>
        </div>

        {/* Formulario */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Nombre del cajero
            </label>
            <input
              type="text"
              value={cajero}
              onChange={e => setCajero(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && puedeAbrir && handleAbrir()}
              placeholder="Tu nombre"
              autoFocus
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Fondo inicial de caja
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={fondo}
              onChange={e => setFondo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && puedeAbrir && handleAbrir()}
              placeholder="0"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-lg font-bold text-zinc-100 placeholder-zinc-600 outline-none focus:border-cyan-500 tabular-nums"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {FONDOS_RAPIDOS.map(f => (
                <button
                  key={f}
                  onClick={() => setFondo(String(f))}
                  className="rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-300 transition-colors"
                >
                  {formatCLP(f)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          <button
            onClick={handleAbrir}
            disabled={!puedeAbrir || enviando}
            className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 py-3.5 text-base font-black text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando ? 'Abriendo...' : '🔓 Abrir turno'}
          </button>
        </div>
      </div>
    </div>
  )
}
