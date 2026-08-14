'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Descuento, TipoDescuento } from '@/types/pos-v3'

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function ModalCrear({ onCrear, onCerrar }: {
  onCrear: (data: any) => Promise<void>
  onCerrar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoDescuento>('porcentaje')
  const [valor, setValor] = useState('')
  const [codigo, setCodigo] = useState('')
  const [maxUsos, setMaxUsos] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCrear = async () => {
    if (!nombre.trim()) { setError('Nombre requerido'); return }
    if (!valor || isNaN(Number(valor)) || Number(valor) <= 0) { setError('Valor inválido'); return }
    if (tipo === 'porcentaje' && Number(valor) > 100) { setError('El porcentaje no puede ser mayor a 100'); return }
    setLoading(true)
    try {
      await onCrear({
        nombre: nombre.trim(),
        tipo,
        valor: Number(valor),
        codigo: codigo.trim().toUpperCase() || null,
        activo: true,
        max_usos: maxUsos ? Number(maxUsos) : null,
      })
      onCerrar()
    } catch { setError('Error al crear descuento') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="font-bold text-zinc-100">Nuevo descuento</h2>
          <button onClick={onCerrar} className="text-zinc-500 hover:text-zinc-300">✕</button>
        </div>
        <div className="px-6 py-4 flex flex-col gap-4">
          <div>
            <label className="label-field">Nombre</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)}
              className="input-field" placeholder="Ej: Descuento empleado" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value as TipoDescuento)} className="input-field">
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="monto_fijo">Monto fijo ($)</option>
              </select>
            </div>
            <div>
              <label className="label-field">Valor</label>
              <input type="number" min="0" value={valor} onChange={e => setValor(e.target.value)}
                className="input-field font-mono"
                placeholder={tipo === 'porcentaje' ? '10' : '500'} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Código (opcional)</label>
              <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())}
                className="input-field font-mono uppercase" placeholder="PROMO2024" />
              <p className="text-xs text-zinc-600 mt-1">Dejar vacío para descuento rápido</p>
            </div>
            <div>
              <label className="label-field">Máx. usos (opcional)</label>
              <input type="number" min="1" value={maxUsos} onChange={e => setMaxUsos(e.target.value)}
                className="input-field font-mono" placeholder="Ilimitado" />
            </div>
          </div>
          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onCerrar} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleCrear} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Creando...' : 'Crear descuento'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DescuentosClient() {
  const [descuentos, setDescuentos] = useState<Descuento[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarModal, setMostrarModal] = useState(false)

  const cargar = useCallback(async () => {
    const res = await fetch('/api/pos/descuentos')
    const data = await res.json()
    // Cargar todos (activos e inactivos)
    setDescuentos(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const crearDescuento = async (data: any) => {
    await fetch('/api/pos/descuentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await cargar()
  }

  const toggleDescuento = async (id: number) => {
    await fetch(`/api/pos/descuentos?id=${id}`, { method: 'PATCH' })
    await cargar()
  }

  const eliminarDescuento = async (id: number) => {
    if (!confirm('¿Eliminar este descuento?')) return
    await fetch(`/api/pos/descuentos?id=${id}`, { method: 'DELETE' })
    await cargar()
  }

  const activos = descuentos.filter(d => d.activo)
  const inactivos = descuentos.filter(d => !d.activo)

  const renderTabla = (lista: Descuento[], titulo: string) => (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <div className="bg-zinc-800/60 px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-zinc-200 text-sm">{titulo}</span>
        <span className="text-xs text-zinc-500">{lista.length} descuento{lista.length !== 1 ? 's' : ''}</span>
      </div>
      {lista.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-600 text-center">Sin descuentos en esta categoría</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800/60 bg-zinc-900/40">
              {['Nombre', 'Tipo', 'Valor', 'Código', 'Usos', 'Estado', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs text-zinc-500 font-semibold uppercase tracking-wider first:rounded-none">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {lista.map(d => (
              <tr key={d.id} className="hover:bg-zinc-800/20 transition-colors">
                <td className="px-4 py-3 font-medium text-zinc-100">{d.nombre}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
                    d.tipo === 'porcentaje'
                      ? 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20'
                      : 'bg-purple-400/10 text-purple-400 border-purple-400/20'
                  }`}>
                    {d.tipo === 'porcentaje' ? '%' : '$'}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono font-bold text-amber-400">
                  {d.tipo === 'porcentaje' ? `${d.valor}%` : formatCLP(d.valor)}
                </td>
                <td className="px-4 py-3">
                  {d.codigo
                    ? <span className="font-mono text-xs bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded">{d.codigo}</span>
                    : <span className="text-zinc-600 text-xs">Rápido</span>
                  }
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400 font-mono">
                  {d.usos}{d.max_usos ? `/${d.max_usos}` : ''}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleDescuento(d.id)}
                    className={`relative h-5 w-10 rounded-full transition-colors ${d.activo ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${d.activo ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => eliminarDescuento(d.id)}
                    className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-6 flex flex-col gap-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400 mb-1">Admin POS</p>
            <h1 className="text-2xl font-black text-zinc-100">Descuentos</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Descuentos rápidos (sin código) y cupones con código para el POS
            </p>
          </div>
          <button onClick={() => setMostrarModal(true)} className="btn-primary">+ Nuevo descuento</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {renderTabla(activos, '✅ Descuentos activos')}
            {inactivos.length > 0 && renderTabla(inactivos, '⏸️ Descuentos inactivos')}
          </>
        )}
      </div>

      {mostrarModal && (
        <ModalCrear
          onCrear={crearDescuento}
          onCerrar={() => { setMostrarModal(false); cargar() }}
        />
      )}

      <style jsx global>{`
        .label-field { display:block; font-size:0.75rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:rgb(161 161 170); margin-bottom:0.375rem; }
        .input-field { width:100%; border-radius:0.75rem; border:1px solid rgb(63 63 70); background-color:rgb(39 39 42/0.8); padding:0.625rem 1rem; font-size:0.875rem; color:rgb(244 244 245); outline:none; }
        .input-field:focus { border-color:rgb(6 182 212); }
        .btn-primary { display:inline-flex; align-items:center; justify-content:center; border-radius:0.75rem; background-color:rgb(8 145 178); padding:0.625rem 1.25rem; font-size:0.875rem; font-weight:700; color:white; transition:background-color 0.15s; cursor:pointer; }
        .btn-primary:hover { background-color:rgb(6 182 212); }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-secondary { display:inline-flex; align-items:center; justify-content:center; border-radius:0.75rem; border:1px solid rgb(63 63 70); padding:0.625rem 1.25rem; font-size:0.875rem; font-weight:600; color:rgb(161 161 170); cursor:pointer; }
        .btn-secondary:hover { background-color:rgb(39 39 42); }
      `}</style>
    </div>
  )
}
