# Empapados — Menú Digital + Panel de Administración

Menú digital mobile-first para Empapados, con carrito de compras, pedido directo por WhatsApp, y un panel de administración para editar productos y ver pedidos sin tocar código.

## Stack

- Next.js 14 (App Router)
- React 18 + Tailwind CSS
- Base de datos: Postgres (Neon, integrado nativamente a Vercel)
- lucide-react (iconos)

## Cómo correrlo en local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` para el menú, y `http://localhost:3000/admin` para el panel (usuario `gino`, clave `gino123` por defecto — ver sección de credenciales más abajo).

**Importante:** sin una base de datos conectada, el menú público sigue funcionando igual (usa un menú de respaldo incluido en el código), pero el panel de administración no podrá cargar ni guardar nada hasta que conectes la base de datos (siguiente sección).

---

## Paso 1 — Subir el proyecto a Vercel

**Desde GitHub (recomendada):**
1. Sube esta carpeta completa a un repo nuevo en GitHub.
2. Entra a [vercel.com](https://vercel.com) → "Add New Project" → conecta el repo.
3. Vercel detecta Next.js automáticamente. Click en "Deploy".

**Desde la terminal:**
```bash
npm install -g vercel
vercel
```

---

## Paso 2 — Conectar la base de datos (Neon Postgres)

El panel de administración necesita una base de datos para guardar productos y pedidos. Vercel lo deja integrado directamente, sin crear cuenta en otro sitio:

1. En el dashboard de tu proyecto en Vercel, ve a la pestaña **Storage**.
2. Click en **Create Database** → elige **Postgres** (Neon).
3. Sigue los pasos (puedes dejar todo en su región por defecto). Al terminar, Vercel conecta automáticamente la variable de entorno `DATABASE_URL` a tu proyecto — no hay que copiarla a mano.
4. Vuelve a hacer **Redeploy** del proyecto (Deployments → … → Redeploy) para que la nueva variable de entorno quede disponible.

### Crear las tablas y cargar el menú inicial

Con la base de datos ya conectada, hay que ejecutar dos archivos SQL **una sola vez**: `db/schema.sql` (crea las tablas) y `db/seed.sql` (carga todo el menú que ya armamos, para no perder el trabajo hecho).

La forma más simple es desde el mismo dashboard de Vercel:
1. Ve a **Storage** → tu base de datos → pestaña **Query** (o "SQL Editor", el nombre exacto puede variar un poco).
2. Pega el contenido completo de `db/schema.sql` y ejecútalo.
3. Pega el contenido completo de `db/seed.sql` y ejecútalo.
4. Recarga el menú público o el panel — ya deberían cargar los datos desde la base de datos en vez del respaldo interno.

(Alternativamente, si te resulta más cómodo, puedes correrlos desde tu computador con `psql "TU_DATABASE_URL" -f db/schema.sql` y lo mismo con `seed.sql`, usando la cadena de conexión que ves en Storage → tu base de datos → `.env.local` tab.)

---

## Paso 3 — Configurar el usuario y clave del panel

Por defecto, el panel usa:
- **Usuario:** `gino`
- **Clave:** `gino123`

Para cambiarlos (recomendado antes de operar en serio), agrega estas variables de entorno en Vercel (Project Settings → Environment Variables):

| Variable | Valor |
|---|---|
| `ADMIN_USERNAME` | el usuario que quieras |
| `ADMIN_PASSWORD` | la clave que quieras |

Después de agregarlas, vuelve a hacer Redeploy para que tomen efecto.

---

## El panel de administración (`/admin`)

Accede desde `tu-sitio.vercel.app/admin`. Pide usuario y clave (`gino` / `gino123` por defecto), y una vez dentro tiene:

- **Productos:** lista todos los productos por categoría. Puedes editar nombre, descripción, precio, categoría, imagen y la restricción de Salvador Allende; crear productos nuevos; o eliminarlos. (Los grupos de modificadores — proteínas, salsas, etc. — de los productos ya armados se mantienen al editar; agregar/cambiar esos grupos desde el panel no está incluido en esta versión.)
- **Pedidos:** lista los pedidos que los clientes envían desde el menú (se guardan automáticamente al hacer click en "Enviar Pedido por WhatsApp", además de abrirse WhatsApp). Puedes marcarlos como completados, eliminarlos, filtrar por estado y por sucursal, y asignar/reasignar a qué sucursal corresponde cada pedido (útil sobre todo para delivery, que no llega pre-asignado). Se actualiza solo cada 30 segundos.
- **Caja (`/admin/cash`):** gestión financiera por sucursal — abrir/cerrar turno, registrar ventas de mostrador y movimientos de caja manuales (ingresos/egresos que no son ventas), y hacer el arqueo al cerrar el turno (normal o ciego) en efectivo, tarjeta y transferencia por separado.

---

## Migración 2 — Gestión multisucursal y financiera

Si ya tenías la base de datos conectada desde antes (schema.sql + seed.sql), necesitas correr **una migración adicional** para habilitar sucursales, turnos de caja, movimientos y arqueo. Es el mismo procedimiento de siempre:

1. Abre el SQL Editor de tu base de datos (Neon).
2. Pega el contenido completo de `db/schema_v2.sql` y ejecútalo.

Esto crea las sucursales Lagunillas y Salvador Allende, las tablas de turnos/movimientos/ventas, y agrega la columna `branch_id` a los pedidos existentes (sin tocar ni borrar nada de lo que ya tenías).

### Cómo funciona la caja

- **Una caja por sucursal:** solo puede haber un turno abierto a la vez por sucursal; el sistema lo impide automáticamente si intentas abrir dos.
- **Monto esperado:** al cerrar el turno, el sistema calcula automáticamente cuánto debería haber en efectivo/tarjeta/transferencia (monto inicial + ventas del turno + movimientos manuales), y lo compara contra lo que el cajero cuenta físicamente.
- **Arqueo normal:** el cajero ve el monto esperado mientras cuenta.
- **Arqueo ciego:** el cajero cuenta y confirma su número antes de ver el esperado; la diferencia se revela recién después, para no sesgar el conteo.
- Las ventas web/WhatsApp **no** se suman automáticamente al efectivo esperado de la caja física (se asume que no pasan por esa caja); el arqueo se basa en lo que el cajero registra manualmente como venta de mostrador durante su turno.

---

## Corrección: botón de WhatsApp en celulares

El botón "Enviar Pedido por WhatsApp" ahora abre la conversación de forma inmediata al hacer click (antes esperaba a guardar el pedido primero, lo cual algunos navegadores de celular bloquean como "ventana emergente no solicitada" al perder el gesto directo del usuario). El guardado en el panel ocurre en paralelo, sin retrasar ni depender de la apertura de WhatsApp. También se bloquea el botón mientras se procesa el envío, para evitar pedidos duplicados si se toca más de una vez.

---

## Dónde editar cosas (si prefieres tocar código en vez del panel)

- **Productos, precios, categorías:** si la base de datos está conectada, todo se edita desde `/admin`. Si no, el código en `app/page.tsx` (arrays `fallbackMenuData` / `fallbackCategories`) sigue funcionando como respaldo.
- **Número de WhatsApp:** constante `WHATSAPP_NUMBER` en `app/page.tsx`.
- **Imágenes de productos:** están en `public/images/`. Sube el archivo nuevo ahí y usa esa ruta (ej. `/images/mi-foto.jpg`) en el campo "Ruta de imagen" del panel, o en el código si editas el respaldo.
- **Logo:** `public/images/logo.png` (con fondo transparente), usado en el navbar.
- **Colores:** los valores hex (`#FF00C8`, `#FFEA00`, `#0A0A0A`) están en las clases de Tailwind dentro de `app/page.tsx`.

## Sucursales y restricción de Sandwich/Completos

Cuando el carrito incluye algún producto de las categorías **Sandwich** o **Completos**, el sistema automáticamente bloquea "Lagunillas" como sucursal de retiro (deja solo "Salvador Allende"), y si el cliente elige Delivery, agrega una nota indicando que el despacho sale solo desde esa sucursal. Esto se controla con el campo `restrictedToSalvadorAllende` de cada producto (editable desde el panel).

## Selección de ingredientes (proteínas, salsas, toques frescos, sazón)

Cada Box/Cono indica cuántas opciones incluye gratis (ej. "Elige 2 Salsas"). El cliente puede elegir menos (mínimo 1) sin problema, y también puede elegir más de lo incluido — cada unidad extra por encima del tope se cobra $1.000 adicional, mostrado claramente en naranja dentro del modal antes de confirmar.

## Notas por producto

En el modal de personalización (o directamente en el carrito para productos simples como bebidas) hay un campo de "Nota" opcional por producto, para pedidos especiales (ej. "sin cebolla"). Esa nota viaja tanto al mensaje de WhatsApp como al detalle del pedido en el panel.

---

## Migración 3 — Estados de pago/preparación, pasar pedidos a caja

Para habilitar lo más reciente (marcar pedidos como pagados y que se reflejen en caja, estados de preparación, edición de modificadores), corre **una migración más**:

1. Abre el SQL Editor de tu base de datos (Neon).
2. Pega el contenido completo de `db/schema_v3.sql` y ejecútalo.

Esto agrega los campos de estado de pago/preparación a los pedidos existentes, sin borrar ni tocar nada de lo que ya tenías.

### Estado de preparación

Cada pedido pasa por: **En Preparación → En Reparto → Entregado**. Se cambia con un click desde la pestaña Pedidos, independiente del estado de pago.

### Marcar como pagado → pasa a caja automáticamente

Cada pedido tiene 3 botones (Efectivo / Tarjeta / Transferencia). Al marcar uno:
- El pedido queda como "Pagado" con ese medio de pago.
- Se crea automáticamente una venta en el turno de caja **abierto** de la sucursal asignada al pedido — por eso es importante asignar la sucursal antes de marcar como pagado (si el pedido llegó por delivery sin sucursal asignada, el sistema te lo va a pedir).
- Si no hay un turno abierto en esa sucursal, el sistema avisa que primero hay que abrir turno en `/admin/cash`.
- Se puede revertir ("Revertir" junto al estado pagado), lo que también quita la venta de la caja para no dejar montos fantasma en el arqueo.

### Editor de modificadores (proteínas, salsas, toques frescos, adicionales)

Al editar un producto desde el panel, ahora aparece cada grupo de selección (ej. "Elige 2 Salsas", "Adicionales") con sus opciones. Para cada opción puedes:
- Cambiar su **nombre**.
- Cambiar su **precio** (déjalo en $0 si va incluida sin costo extra).
- **Eliminarla** con el ícono de basurero.
- **Agregar opciones nuevas** al grupo con el botón "Agregar opción".

También puedes cambiar cuántas unidades incluye el grupo sin costo (el número junto a "Incluye").

### Impresión (comanda y resumen de ventas)

Pensada para impresora térmica POS (formato angosto de 80mm, fuente monoespaciada):
- **Comanda por pedido:** ícono de impresora en cada tarjeta de pedido (pestaña Pedidos). Imprime cliente, hora, modalidad, productos con sus selecciones/notas, y total.
- **Resumen de ventas del día:** ícono de impresora en `/admin/cash`, junto al turno abierto. Imprime el total vendido, desglose por medio de pago, movimientos de caja, y el efectivo esperado.

Ambos abren una ventana nueva y llaman a imprimir automáticamente; usa la impresora térmica configurada como predeterminada en el sistema operativo del computador/tablet donde esté abierto el panel (no requiere ningún driver ni configuración adicional de parte de la app).

### Corrección de zoom en celular

Se fijó el viewport de la página (`width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`) para que no se pueda hacer zoom ni con gestos ni automáticamente al tocar un campo de texto — la página se ve "tal cual carga", sin que el usuario pueda desajustar el zoom por accidente.

---

## Migración 4 — Aceptar y cancelar pedidos

Para habilitar los botones de Aceptar/Cancelar en el panel de pedidos, corre **una migración más**:

1. Abre el SQL Editor de tu base de datos (Neon).
2. Pega el contenido completo de `db/schema_v4.sql` y ejecútalo.

Esto agrega dos columnas a la tabla `orders`:
- `accepted` (boolean): indica si el pedido fue aceptado por cocina.
- `cancel_reason` (text): guarda el motivo de cancelación cuando `status = 'cancelado'`.

Los pedidos existentes no se ven afectados (quedan con `accepted = false` y sin motivo de cancelación).

### Cómo funcionan los nuevos botones

**Aceptar pedido:**
- Aparece en cada tarjeta de pedido activo (no cancelado).
- Al hacer click, el pedido muestra un badge verde "Aceptado". Sirve para confirmarle al cliente (por WhatsApp u otro medio) que su pedido fue recibido y está en marcha.
- Una vez aceptado, el botón queda desactivado (no se puede "desaceptar" accidentalmente).

**Cancelar pedido:**
- Al hacer click aparece un popup con 6 causas rápidas: Sin stock, Cliente no contesta, Dirección fuera de zona, Pedido duplicado, Cierre anticipado, Otro motivo.
- Siempre hay un cuadro de texto para agregar un detalle adicional (obligatorio si se elige "Otro motivo").
- El pedido **no se elimina**: queda guardado en la base de datos con `status = 'cancelado'` y el motivo registrado.
- Los pedidos cancelados se pueden ver en el filtro "Cancelados" del panel. Aparecen con fondo rojizo, badge "Cancelado", y el total tachado.
- Si el pedido tenía un pago registrado, se revierte automáticamente (se quita la venta de caja).
- Solo se puede eliminar un pedido cancelado haciendo click en el ícono de basura (eliminación permanente).

---

## Migración 5 — Reportes y estadísticas

Para habilitar el módulo de reportes, corre **una migración más**:

1. Abre el SQL Editor de tu base de datos (Neon).
2. Pega el contenido completo de `db/schema_v5.sql` y ejecútalo.

Esto solo crea índices en la tabla `orders` y `cash_shifts` para acelerar las consultas del panel de reportes. No modifica ni elimina ningún dato.

### Cómo usar los reportes (`/admin/reports`)

Accede desde el botón **Reportes** en el header del panel de administración. El módulo incluye:

- **Resumen:** KPIs del período (ventas totales, cantidad de pedidos, ticket promedio), desglose por local, por medio de pago, y top 10 productos.
- **Diario:** ventas día a día con desglose por efectivo, tarjeta y transferencia.
- **Mensual:** ventas mes a mes dentro del año seleccionado.
- **Anual:** histórico año a año desde 2024.
- **Por Local:** desglose mensual de ventas por cada sucursal.
- **Productos:** ranking completo de todos los productos vendidos, ordenable por unidades, pedidos o ingresos.
- **Pagos:** detalle diario por medio de pago (efectivo, tarjeta, transferencia).
- **Modalidad:** comparativa entre delivery, retiro en local y mostrador.
- **Turnos:** historial de arqueos de caja cerrados con diferencia contado vs. esperado.

Todos los reportes se pueden filtrar por **local** y **año/mes** con los selectores del header. Casi todos permiten exportar a **CSV** con el botón de descarga (arriba a la derecha).
