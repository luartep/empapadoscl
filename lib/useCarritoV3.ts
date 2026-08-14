'use client'

import { useState, useCallback, useMemo } from 'react'
import type { ItemCarrito, Producto, ModificadorSeleccionado } from '@/types/pos'
import type { DescuentoAplicado, DatosOrden } from '@/types/pos-v3'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export function useCarritoV3() {
  const [items, setItems] = useState<ItemCarrito[]>([])
  const [descuentoAplicado, setDescuentoAplicado] = useState<DescuentoAplicado | null>(null)
  const [datosOrden, setDatosOrden] = useState<DatosOrden>({ tipo: 'retiro' })

  const { subtotal, descuentoMonto, total } = useMemo(() => {
    const subtotal = items.reduce((acc, i) => acc + i.precio_total, 0)
    const descuentoMonto = descuentoAplicado?.monto_calculado ?? 0
    const total = Math.max(0, subtotal - descuentoMonto)
    return { subtotal, descuentoMonto, total }
  }, [items, descuentoAplicado])

  const agregarItem = useCallback((
    producto: Producto,
    modificadores: ModificadorSeleccionado[] = [],
    notas = ''
  ) => {
    const precioExtras = modificadores.reduce((a, m) => a + m.precio_extra, 0)
    const precio_unitario = producto.precio + precioExtras
    const clave = `${producto.id}__${modificadores.map(m => m.opcion_id).sort().join(',')}`

    setItems(prev => {
      const existente = prev.find(i =>
        `${i.producto_id}__${i.modificadores.map(m => m.opcion_id).sort().join(',')}` === clave &&
        i.notas === notas
      )
      if (existente) {
        return prev.map(i =>
          i.uid === existente.uid
            ? { ...i, cantidad: i.cantidad + 1, precio_total: (i.cantidad + 1) * i.precio_unitario }
            : i
        )
      }
      return [...prev, {
        uid: uid(),
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        precio_base: producto.precio,
        cantidad: 1,
        modificadores,
        precio_unitario,
        precio_total: precio_unitario,
        notas,
      }]
    })
  }, [])

  const setCantidad = useCallback((uid: string, cantidad: number) => {
    if (cantidad <= 0) {
      setItems(prev => prev.filter(i => i.uid !== uid))
      return
    }
    setItems(prev => prev.map(i =>
      i.uid === uid ? { ...i, cantidad, precio_total: cantidad * i.precio_unitario } : i
    ))
  }, [])

  const quitarItem = useCallback((uid: string) => {
    setItems(prev => prev.filter(i => i.uid !== uid))
  }, [])

  const limpiar = useCallback(() => {
    setItems([])
    setDescuentoAplicado(null)
    setDatosOrden({ tipo: 'retiro' })
  }, [])

  // Recalcular monto del descuento cuando cambia el subtotal
  const aplicarDescuento = useCallback((d: DescuentoAplicado | null) => {
    if (!d) { setDescuentoAplicado(null); return }
    // Recalcular sobre subtotal actual
    const subtotalActual = items.reduce((acc, i) => acc + i.precio_total, 0)
    let monto = 0
    if (d.tipo === 'porcentaje') monto = Math.round(subtotalActual * d.valor / 100)
    else if (d.tipo === 'monto_fijo') monto = Math.min(d.valor, subtotalActual)
    setDescuentoAplicado({ ...d, monto_calculado: monto })
  }, [items])

  return {
    items,
    subtotal,
    descuentoAplicado,
    descuentoMonto,
    total,
    datosOrden,
    setDatosOrden,
    agregarItem,
    setCantidad,
    quitarItem,
    aplicarDescuento,
    limpiar,
    cantidadTotal: items.reduce((a, i) => a + i.cantidad, 0),
    isEmpty: items.length === 0,
  }
}
