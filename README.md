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

Accede desde `tu-sitio.vercel.app/admin`. Pide usuario y clave, y una vez dentro tiene dos secciones:

- **Productos:** lista todos los productos por categoría. Puedes editar nombre, descripción, precio, categoría, imagen y la restricción de Salvador Allende; crear productos nuevos; o eliminarlos. (Los grupos de modificadores — proteínas, salsas, etc. — de los productos ya armados se mantienen al editar; agregar/cambiar esos grupos desde el panel no está incluido en esta versión.)
- **Pedidos:** lista los pedidos que los clientes envían desde el menú (se guardan automáticamente al hacer click en "Enviar Pedido por WhatsApp", además de abrirse WhatsApp). Puedes marcarlos como completados, y filtrar por pendiente/completado/todos. Se actualiza solo cada 30 segundos.

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
