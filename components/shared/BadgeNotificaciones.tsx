'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Notificacion } from '@/types/pos-v3'

const TIPO_ICON: Record<Notificacion['tipo'], string> = {
  orden_lista:    '✅',
  orden_demorada: '⏰',
  stock_bajo:     '📦',
  sistema:        '⚙️',
}

const TIPO_COLOR: Record<Notificacion['tipo'], string> = {
  orden_lista:    'text-emerald-400',
  orden_demorada: 'text-amber-400',
  stock_bajo:     'text-red-400',
  sistema:        'text-zinc-400',
}

function formatTiempo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h`
}

export default function BadgeNotificaciones() {
  const [notifs, setNotifs] = useState<Notificacion[]>([])
  const [abierto, setAbierto] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/pos/notificaciones?no_leidas=1')
      if (res.ok) setNotifs(await res.json())
    } catch { /* silencioso */ }
  }, [])

  useEffect(() => {
    cargar()
    const interval = setInterval(cargar, 15_000)
    return () => clearInterval(interval)
  }, [cargar])

  const marcarLeidas = async () => {
    await fetch('/api/pos/notificaciones', { method: 'PATCH' })
    setNotifs([])
    setAbierto(false)
  }

  const count = notifs.length

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto(!abierto)}
        className={`relative rounded-xl border px-3 py-2 text-sm transition-colors ${
          count > 0
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
            : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
        }`}
      >
        🔔
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {abierto && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <p className="text-sm font-bold text-zinc-100">Notificaciones</p>
              {count > 0 && (
                <button
                  onClick={marcarLeidas}
                  className="text-xs text-zinc-500 hover:text-cyan-400 transition-colors"
                >
                  Marcar todas leídas
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-zinc-600">
                  Sin notificaciones nuevas
                </div>
              ) : (
                notifs.map(n => (
                  <div key={n.id} className="flex gap-3 px-4 py-3 border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/40 transition-colors">
                    <span className="text-lg shrink-0">{TIPO_ICON[n.tipo]}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${TIPO_COLOR[n.tipo]}`}>{n.titulo}</p>
                      {n.mensaje && <p className="text-xs text-zinc-500 mt-0.5 truncate">{n.mensaje}</p>}
                      <p className="text-xs text-zinc-600 mt-1">{formatTiempo(n.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
