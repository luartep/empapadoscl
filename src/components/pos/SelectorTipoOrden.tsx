'use client'

import { useState } from 'react'
import type { DatosOrden, TipoOrden } from '@/types/pos-v3'

interface Props {
  datos: DatosOrden
  onChange: (datos: DatosOrden) => void
}

export default function SelectorTipoOrden({ datos, onChange }: Props) {
  const [expandido, setExpandido] = useState(datos.tipo === 'delivery')

  const setTipo = (tipo: TipoOrden) => {
    onChange({ tipo })
    setExpandido(tipo === 'delivery')
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Toggle retiro / delivery */}
      <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
        {([
          { id: 'retiro',   label: 'Retiro en local', icon: '🏪' },
          { id: 'delivery', label: 'Delivery',         icon: '🛵' },
        ] as const).map(op => (
          <button
            key={op.id}
            onClick={() => setTipo(op.id)}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
              datos.tipo === op.id
                ? op.id === 'delivery'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-900/30'
                  : 'bg-cyan-600 text-white shadow-md shadow-cyan-900/30'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span>{op.icon}</span>
            <span>{op.label}</span>
          </button>
        ))}
      </div>

      {/* Datos del cliente — sólo para delivery */}
      {datos.tipo === 'delivery' && (
        <div className="flex flex-col gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 animate-in slide-in-from-top-1 duration-200">
          <input
            type="text"
            placeholder="Nombre del cliente *"
            value={datos.cliente_nombre ?? ''}
            onChange={e => onChange({ ...datos, cliente_nombre: e.target.value })}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
          />
          <input
            type="tel"
            placeholder="Teléfono"
            value={datos.cliente_telefono ?? ''}
            onChange={e => onChange({ ...datos, cliente_telefono: e.target.value })}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
          />
          <input
            type="text"
            placeholder="Dirección de entrega"
            value={datos.direccion_entrega ?? ''}
            onChange={e => onChange({ ...datos, direccion_entrega: e.target.value })}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
          />
        </div>
      )}

      {/* Datos simplificados para retiro — nombre opcional */}
      {datos.tipo === 'retiro' && (
        <input
          type="text"
          placeholder="Nombre (opcional)"
          value={datos.cliente_nombre ?? ''}
          onChange={e => onChange({ ...datos, cliente_nombre: e.target.value })}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-cyan-500"
        />
      )}
    </div>
  )
}
