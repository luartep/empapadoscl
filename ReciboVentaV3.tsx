'use client'

import type { MetodoPago, PagoMixto } from '@/types/pos'
import type { DatosOrden, DescuentoAplicado } from '@/types/pos-v3'

interface Props {
  venta: {
    numero_orden: string
    numero_correlativo?: number
    items: any[]
    subtotal: number
    descuentoAplicado: DescuentoAplicado | null
    descuentoMonto: number
    total: number
    metodo: MetodoPago
    pagos: PagoMixto
    vuelto: number
    datosOrden: DatosOrden
  }
  onNuevaVenta: () => void
}

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

const METODO_LABEL: Record<MetodoPago, string> = {
  efectivo: 'Efectivo', debito: 'Débito', transferencia: 'Transferencia', mixto: 'Pago mixto',
}

export default function ReciboVentaV3({ venta, onNuevaVenta }: Props) {
  const esDelivery = venta.datosOrden.tipo === 'delivery'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-sm flex flex-col gap-4">

        {/* Recibo */}
        <div id="recibo-v3" className="rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">

          {/* Header */}
          <div className={`px-6 py-5 text-center border-b border-zinc-800 ${esDelivery ? 'bg-orange-500/10' : 'bg-cyan-500/5'}`}>
            <p className="text-2xl font-black tracking-wider text-zinc-100">🍔 EMPAPADOS</p>
            <p className="text-xs text-zinc-500 mt-0.5">Fast Food · Coronel</p>

            {/* Tipo de orden destacado */}
            <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ${
              esDelivery
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
            }`}>
              <span>{esDelivery ? '🛵' : '🏪'}</span>
              <span>{esDelivery ? 'DELIVERY' : 'RETIRO EN LOCAL'}</span>
            </div>

            {/* Número de orden grande y visible */}
            {venta.numero_correlativo && (
              <div className="mt-3">
                <p className="text-xs text-zinc-600">Número de orden</p>
                <p className="text-5xl font-black text-zinc-100 tabular-nums">#{venta.numero_correlativo}</p>
              </div>
            )}

            <div className="mt-3 text-xs text-zinc-600 font-mono">
              {venta.numero_orden} · {new Date().toLocaleString('es-CL', {
                day: '2-digit', month: '2-digit', year: '2-digit',
                hour: '2-digit', minute: '2-digit',
              })}
            </div>
          </div>

          {/* Datos del cliente si aplica */}
          {(venta.datosOrden.cliente_nombre || venta.datosOrden.cliente_telefono) && (
            <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-800/30">
              {venta.datosOrden.cliente_nombre && (
                <p className="text-sm font-semibold text-zinc-200">👤 {venta.datosOrden.cliente_nombre}</p>
              )}
              {venta.datosOrden.cliente_telefono && (
                <p className="text-xs text-zinc-400">📞 {venta.datosOrden.cliente_telefono}</p>
              )}
              {venta.datosOrden.direccion_entrega && (
                <p className="text-xs text-zinc-400">📍 {venta.datosOrden.direccion_entrega}</p>
              )}
            </div>
          )}

          {/* Ítems */}
          <div className="px-5 py-4" style={{ fontFamily: "'Courier New', monospace" }}>
            <div className="flex flex-col gap-2">
              {venta.items.map((item: any) => (
                <div key={item.uid}>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-200 font-semibold">
                      {item.cantidad > 1 && <span className="text-cyan-400">{item.cantidad}× </span>}
                      {item.producto_nombre}
                    </span>
                    <span className="text-zinc-200 tabular-nums">{formatCLP(item.precio_total)}</span>
                  </div>
                  {item.modificadores?.map((m: any) => (
                    <div key={m.opcion_id} className="flex justify-between text-xs text-zinc-500 pl-3">
                      <span>+ {m.opcion_nombre}</span>
                      {m.precio_extra > 0 && <span>{formatCLP(m.precio_extra * item.cantidad)}</span>}
                    </div>
                  ))}
                  {item.notas && (
                    <p className="text-xs text-amber-400/70 pl-3 italic">📝 {item.notas}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="my-3 border-t border-dashed border-zinc-700" />

            {/* Totales */}
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCLP(venta.subtotal)}</span>
              </div>
              {venta.descuentoMonto > 0 && venta.descuentoAplicado && (
                <div className="flex justify-between text-amber-400">
                  <span>🏷️ {venta.descuentoAplicado.nombre}</span>
                  <span className="tabular-nums">−{formatCLP(venta.descuentoMonto)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-zinc-100 mt-1">
                <span>TOTAL</span>
                <span className="tabular-nums">{formatCLP(venta.total)}</span>
              </div>
            </div>

            <div className="my-3 border-t border-dashed border-zinc-700" />

            {/* Pago */}
            <div className="flex flex-col gap-1 text-xs text-zinc-400">
              <div className="flex justify-between">
                <span>Método de pago</span>
                <span>{METODO_LABEL[venta.metodo]}</span>
              </div>
              {venta.pagos.efectivo > 0 && (
                <div className="flex justify-between">
                  <span>Efectivo recibido</span>
                  <span className="tabular-nums">{formatCLP(venta.pagos.efectivo + venta.vuelto)}</span>
                </div>
              )}
              {venta.pagos.debito > 0 && (
                <div className="flex justify-between">
                  <span>Débito</span>
                  <span className="tabular-nums">{formatCLP(venta.pagos.debito)}</span>
                </div>
              )}
              {venta.pagos.transferencia > 0 && (
                <div className="flex justify-between">
                  <span>Transferencia</span>
                  <span className="tabular-nums">{formatCLP(venta.pagos.transferencia)}</span>
                </div>
              )}
              {venta.vuelto > 0 && (
                <div className="flex justify-between text-emerald-400 font-bold mt-1">
                  <span>Vuelto</span>
                  <span className="tabular-nums">{formatCLP(venta.vuelto)}</span>
                </div>
              )}
            </div>

            <div className="mt-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="h-px flex-1 bg-zinc-800" />
                <span className="text-xs text-zinc-700">¡Gracias por tu preferencia!</span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-xl border border-zinc-600 bg-zinc-800 hover:bg-zinc-700 py-3 text-sm font-semibold text-zinc-200 transition-colors flex items-center justify-center gap-2"
          >
            🖨️ Imprimir
          </button>
          <button
            onClick={onNuevaVenta}
            className="flex-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 py-3 text-sm font-bold text-white transition-colors"
          >
            + Nueva venta
          </button>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body > *:not(#recibo-v3) { display: none !important; }
          #recibo-v3 {
            width: 80mm !important;
            border: none !important;
            background: white !important;
            color: black !important;
          }
          #recibo-v3 * { color: black !important; }
        }
      `}</style>
    </div>
  )
}
