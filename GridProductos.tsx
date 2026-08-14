'use client'

import { useMemo, useState } from 'react'
import type { Producto } from '@/types/pos'

interface Props {
  productos: Producto[]
  onSeleccionar: (producto: Producto) => void
}

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

// Campos opcionales que pueden o no existir en el tipo Producto real del proyecto.
// Se leen de forma defensiva para no romper el build si el shape cambia.
function campo<T = any>(p: Producto, key: string, fallback: T): T {
  const v = (p as any)?.[key]
  return v === undefined || v === null ? fallback : v
}

export default function GridProductos({ productos, onSeleccionar }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState<string>('Todas')

  const categorias = useMemo(() => {
    const set = new Set<string>()
    productos.forEach(p => set.add(campo(p, 'categoria', 'General')))
    return ['Todas', ...Array.from(set)]
  }, [productos])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return productos.filter(p => {
      const disponible = campo(p, 'disponible', true) && campo(p, 'activo', true)
      if (!disponible) return false
      const cat = campo(p, 'categoria', 'General')
      if (categoria !== 'Todas' && cat !== categoria) return false
      if (q && !p.nombre.toLowerCase().includes(q)) return false
      return true
    })
  }, [productos, busqueda, categoria])

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Buscador */}
      <div className="shrink-0">
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="🔍 Buscar producto..."
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
        />
      </div>

      {/* Categorías */}
      {categorias.length > 2 && (
        <div className="flex gap-1.5 overflow-x-auto shrink-0 pb-1">
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoria(cat)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                categoria === cat
                  ? 'bg-cyan-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-700 gap-2">
            <span className="text-4xl">🔍</span>
            <p className="text-sm">Sin resultados</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-3">
            {filtrados.map(p => {
              const imagen = campo<string | null>(p, 'imagen_url', null)
              const descripcion = campo<string | null>(p, 'descripcion', null)
              return (
                <button
                  key={p.id}
                  onClick={() => onSeleccionar(p)}
                  className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 hover:border-cyan-500/50 hover:bg-zinc-800/60 transition-all text-left overflow-hidden active:scale-[0.98]"
                >
                  <div className="aspect-square w-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                    {imagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagen} alt={p.nombre} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-4xl opacity-40 group-hover:opacity-70 transition-opacity">🍔</span>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col gap-0.5">
                    <p className="text-sm font-semibold text-zinc-100 leading-tight line-clamp-2">{p.nombre}</p>
                    {descripcion && (
                      <p className="text-xs text-zinc-500 line-clamp-1">{descripcion}</p>
                    )}
                    <p className="text-sm font-black text-cyan-400 tabular-nums mt-1">{formatCLP(p.precio)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
