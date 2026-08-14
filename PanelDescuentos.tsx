'use client'

import { useState } from 'react'
import type { Descuento, DescuentoAplicado } from '@/types/pos-v3'

interface Props {
  subtotal: number
  descuentos: Descuento[]
  aplicado: DescuentoAplicado | null
  onAplicar: (d: DescuentoAplicado | null) => void
}

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function calcularMonto(descuento: Descuento, subtotal: number): number {
  if (descuento.tipo === 'porcentaje') return Math.round(subtotal * descuento.valor / 100)
  if (descuento.tipo === 'monto_fijo') return Math.min(descuento.valor, subtotal)
  return 0
}

export default function PanelDescuentos({ subtotal, descuentos, aplicado, onAplicar }: Props) {
  const [expandido, setExpandido] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [errorCodigo, setErrorCodigo] = useState('')

  const buscarCodigo = async () => {
    if (!codigo.trim()) return
    setBuscando(true)
    setErrorCodigo('')
    try {
      const res = await fetch(`/api/pos/descuentos?codigo=${encodeURIComponent(codigo)}`)
      if (!res.ok) {
        setErrorCodigo('Código no válido o expirado')
        return
      }
      const desc: Descuento = await res.json()
      const monto = calcularMonto(desc, subtotal)
      onAplicar({
        descuento_id: desc.id,
        nombre: desc.nombre,
        tipo: desc.tipo,
        valor: desc.valor,
        monto_calculado: monto,
      })
      setCodigo('')
      setExpandido(false)
    } catch {
      setErrorCodigo('Error al validar código')
    } finally {
      setBuscando(false)
    }
  }

  const aplicarDescuentoRapido = (desc: Descuento) => {
    const monto = calcularMonto(desc, subtotal)
    onAplicar({
      descuento_id: desc.id,
      nombre: desc.nombre,
      tipo: desc.tipo,
      valor: desc.valor,
      monto_calculado: monto,
    })
    setExpandido(false)
  }

  // Descuentos rápidos (sin código)
  const rapidos = descuentos.filter(d => !d.codigo)

  return (
    <div>
      {/* Descuento aplicado */}
      {aplicado ? (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-sm">🏷️</span>
            <div>
              <p className="text-xs font-bold text-amber-300">{aplicado.nombre}</p>
              <p className="text-xs text-amber-400/70">
                {aplicado.tipo === 'porcentaje' ? `${aplicado.valor}%` : formatCLP(aplicado.valor)} de descuento
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-amber-400 text-sm">−{formatCLP(aplicado.monto_calculado)}</span>
            <button
              onClick={() => onAplicar(null)}
              className="text-zinc-500 hover:text-red-400 transition-colors text-sm"
            >✕</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setExpandido(!expandido)}
          className="w-full flex items-center justify-between rounded-xl border border-dashed border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <span className="flex items-center gap-1.5">🏷️ Agregar descuento</span>
          <span>{expandido ? '▲' : '▼'}</span>
        </button>
      )}

      {/* Panel expandido */}
      {expandido && !aplicado && (
        <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
          {/* Cupón de código */}
          <div className="px-3 py-3 border-b border-zinc-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Código de cupón</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ingresar código..."
                value={codigo}
                onChange={e => { setCodigo(e.target.value.toUpperCase()); setErrorCodigo('') }}
                onKeyDown={e => e.key === 'Enter' && buscarCodigo()}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-cyan-500 font-mono uppercase"
              />
              <button
                onClick={buscarCodigo}
                disabled={buscando || !codigo.trim()}
                className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 transition-colors"
              >
                {buscando ? '...' : 'Aplicar'}
              </button>
            </div>
            {errorCodigo && (
              <p className="text-xs text-red-400 mt-1">{errorCodigo}</p>
            )}
          </div>

          {/* Descuentos rápidos */}
          {rapidos.length > 0 && (
            <div className="px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Descuentos rápidos</p>
              <div className="flex flex-col gap-1">
                {rapidos.map(d => (
                  <button
                    key={d.id}
                    onClick={() => aplicarDescuentoRapido(d)}
                    className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-left hover:border-zinc-500 hover:bg-zinc-800 transition-colors"
                  >
                    <span className="text-sm text-zinc-200">{d.nombre}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-amber-400">
                        {d.tipo === 'porcentaje' ? `${d.valor}%` : formatCLP(d.valor)}
                      </span>
                      <span className="text-xs text-zinc-600">
                        = {formatCLP(calcularMonto(d, subtotal))}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
