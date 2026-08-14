'use client'

import { useMemo, useState } from 'react'
import type { Producto, ModificadorSeleccionado } from '@/types/pos'

interface OpcionModificador {
  id: number | string
  nombre: string
  precio_extra: number
}

interface GrupoModificador {
  id: number | string
  nombre: string
  obligatorio?: boolean
  seleccion_multiple?: boolean
  opciones: OpcionModificador[]
}

interface Props {
  producto: Producto
  onConfirmar: (modificadores: ModificadorSeleccionado[], notas: string) => void
  onCerrar: () => void
}

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

export default function ModalModificadores({ producto, onConfirmar, onCerrar }: Props) {
  // Lee grupos de modificadores del producto si existen en el modelo de datos.
  // Si el producto no trae modificadores, el modal solo pide cantidad/notas.
  const grupos: GrupoModificador[] = useMemo(() => {
    const g = (producto as any)?.modificadores ?? (producto as any)?.grupos_modificadores
    return Array.isArray(g) ? g : []
  }, [producto])

  const [seleccion, setSeleccion] = useState<Record<string, OpcionModificador[]>>({})
  const [notas, setNotas] = useState('')

  const toggleOpcion = (grupo: GrupoModificador, opcion: OpcionModificador) => {
    setSeleccion(prev => {
      const actuales = prev[grupo.id] ?? []
      const yaEsta = actuales.some(o => o.id === opcion.id)

      if (grupo.seleccion_multiple) {
        const siguientes = yaEsta
          ? actuales.filter(o => o.id !== opcion.id)
          : [...actuales, opcion]
        return { ...prev, [grupo.id]: siguientes }
      }
      // Selección única: reemplaza (o deselecciona si ya estaba)
      return { ...prev, [grupo.id]: yaEsta ? [] : [opcion] }
    })
  }

  const modificadoresPlanos: ModificadorSeleccionado[] = useMemo(() => {
    return Object.values(seleccion).flat().map(o => ({
      opcion_id: o.id,
      opcion_nombre: o.nombre,
      precio_extra: o.precio_extra,
    })) as unknown as ModificadorSeleccionado[]
  }, [seleccion])

  const totalExtras = modificadoresPlanos.reduce((a, m: any) => a + (m.precio_extra || 0), 0)

  const gruposFaltantes = grupos.filter(g => g.obligatorio && (seleccion[g.id]?.length ?? 0) === 0)
  const puedeConfirmar = gruposFaltantes.length === 0

  const handleConfirmar = () => {
    if (!puedeConfirmar) return
    onConfirmar(modificadoresPlanos, notas.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-start justify-between shrink-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400 mb-0.5">Agregar</p>
            <h2 className="text-lg font-black text-zinc-100">{producto.nombre}</h2>
            <p className="text-sm text-zinc-500 mt-0.5">{formatCLP(producto.precio)}</p>
          </div>
          <button onClick={onCerrar} className="text-zinc-500 hover:text-zinc-300 p-1 shrink-0">✕</button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {grupos.map(grupo => {
            const activos = seleccion[grupo.id] ?? []
            return (
              <div key={grupo.id}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-zinc-200">
                    {grupo.nombre}
                    {grupo.obligatorio && <span className="text-red-400 ml-1">*</span>}
                  </p>
                  {grupo.seleccion_multiple && (
                    <span className="text-xs text-zinc-600">elige varios</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {grupo.opciones.map(op => {
                    const activo = activos.some(o => o.id === op.id)
                    return (
                      <button
                        key={op.id}
                        onClick={() => toggleOpcion(grupo, op)}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                          activo
                            ? 'border-cyan-500 bg-cyan-500/10'
                            : 'border-zinc-700 bg-zinc-800/60 hover:border-zinc-600'
                        }`}
                      >
                        <span className={`text-sm ${activo ? 'text-cyan-300 font-semibold' : 'text-zinc-300'}`}>
                          {op.nombre}
                        </span>
                        <span className="text-xs font-mono text-zinc-500">
                          {op.precio_extra > 0 ? `+${formatCLP(op.precio_extra)}` : 'Gratis'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Notas */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Notas para cocina (opcional)
            </label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              placeholder="Sin cebolla, agregar salsa extra..."
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-cyan-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-zinc-800 shrink-0">
          {!puedeConfirmar && (
            <p className="text-xs text-red-400 mb-2">Selecciona una opción en: {gruposFaltantes.map(g => g.nombre).join(', ')}</p>
          )}
          <button
            onClick={handleConfirmar}
            disabled={!puedeConfirmar}
            className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 py-3.5 text-base font-black text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Agregar · {formatCLP(producto.precio + totalExtras)}
          </button>
        </div>
      </div>
    </div>
  )
}
