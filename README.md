# 🚀 POS v3 — Empapados (Versión Profesional)

Mejoras sobre v2: tipo de orden (retiro/delivery), descuentos avanzados con cupones,
notificaciones entre cocina y caja, cierre de caja profesional con PDF, y recibo mejorado.

---

## Módulos v3

| Módulo | Novedad v3 |
|---|---|
| POS Caja | Retiro / Delivery, descuentos avanzados, notificaciones, recibo mejorado |
| Cierre de caja | Resumen completo por método + tipo de orden + top productos |
| Descuentos | CRUD desde admin: porcentaje, monto fijo, código de cupón, límite de usos |
| Notificaciones | Badge en el POS, polling 15s, marca como leído |
| Recibo v3 | Número de orden grande, tipo de orden destacado, datos del cliente |

---

## Archivos nuevos / modificados

```
sql/
└── v3_extensiones.sql          ← Ejecutar en Neon (complementa v1 y v2)

src/
├── types/pos-v3.ts             ← DatosOrden, Descuento, Notificacion, CierreCaja
├── lib/
│   ├── pos-v3-db.ts            ← Queries: descuentos, notificaciones, cierre
│   └── useCarritoV3.ts         ← Hook del carrito con descuento y datos de orden
├── app/
│   └── admin/
│       ├── layout.tsx          ← Sidebar actualizado (incluye Descuentos)
│       ├── pos/
│       │   ├── page.tsx
│       │   └── POSClientV3.tsx ← Orquestador principal v3
│       └── descuentos/
│           ├── page.tsx
│           └── DescuentosClient.tsx ← CRUD de descuentos
├── components/
│   ├── pos/
│   │   ├── SelectorTipoOrden.tsx   ← Toggle Retiro / Delivery + datos cliente
│   │   ├── PanelDescuentos.tsx     ← Código de cupón + descuentos rápidos
│   │   ├── PanelCarritoV3.tsx      ← Carrito integrado con v3
│   │   ├── ReciboVentaV3.tsx       ← Recibo con número de orden y tipo
│   │   └── CierreCajaModal.tsx     ← Modal de cierre con PDF
│   └── shared/
│       └── BadgeNotificaciones.tsx ← 🔔 Badge con polling
└── app/api/
    ├── pos/descuentos/
    │   ├── route.ts            ← GET/POST/PATCH/DELETE descuentos + validar código
    │   └── uso/route.ts        ← POST registrar uso
    ├── pos/notificaciones/
    │   └── route.ts            ← GET/PATCH notificaciones
    └── cierre/
        └── route.ts            ← GET cierre de caja por turno
```

---

## Instalación

### 1. SQL
```sql
\i v3_extensiones.sql
```
Agrega columnas `tipo_orden`, `cliente_nombre`, `cliente_telefono`, `direccion_entrega`
a la tabla `ventas`, y crea las tablas `descuentos` y `notificaciones`.

### 2. Copiar archivos
Pegar sobre el proyecto (reemplaza `layout.tsx` y `pos/page.tsx` de v2).

---

## Flujo de delivery en el POS

1. Cajero selecciona 🛵 Delivery en el carrito
2. Ingresa nombre (obligatorio), teléfono y dirección (opcionales)
3. El botón "Cobrar" solo se habilita cuando hay nombre
4. El recibo muestra los datos del cliente y "DELIVERY" destacado
5. La comanda llega a cocina igual que una orden de retiro

## Descuentos — cómo funcionan

**Descuentos rápidos** (sin código): aparecen directamente como opciones en el carrito.
**Cupones** (con código): el cajero escribe el código y se valida contra la DB.
Si el cupón tiene límite de usos, se descuenta al confirmar la venta.

## Notificaciones — cómo se crean

Desde cualquier proceso interno (cocina, inventario):
```ts
import { crearNotificacion } from '@/lib/pos-v3-db'

await crearNotificacion({
  tipo: 'orden_lista',
  titulo: 'Orden #042 lista',
  mensaje: 'Empapado clásico x2 listo para entregar',
  referencia: '20240813-042',
})
```
El badge del POS la muestra en hasta 15 segundos.
