-- ============================================================================
-- Esquema de base de datos para Empapados
-- Ejecutar una sola vez al conectar la base de datos (ver README para el paso a paso)
-- ============================================================================

-- Productos del menú. modifier_groups guarda la estructura completa de
-- proteínas/salsas/toques/sazón/adicionales como JSON, igual a como vivía
-- en el código (ModifierGroup[]). Esto evita normalizar en varias tablas
-- y hace que el panel de administración sea mucho más simple de construir.
CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  price           INTEGER NOT NULL,
  category        TEXT NOT NULL,
  image           TEXT,
  allows_extras   BOOLEAN NOT NULL DEFAULT false,
  restricted_to_salvador_allende BOOLEAN NOT NULL DEFAULT false,
  modifier_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Categorías del menú (Box, Conos, Sandwich, etc.) con su orden de aparición.
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- Pedidos generados desde el menú público al hacer click en
-- "Enviar Pedido por WhatsApp". Se guardan ANTES de abrir el link de
-- WhatsApp, para que el panel los vea aunque el cliente no complete el envío.
CREATE TABLE IF NOT EXISTS orders (
  id                SERIAL PRIMARY KEY,
  customer_name     TEXT NOT NULL,
  order_type        TEXT NOT NULL,          -- 'delivery' | 'retiro'
  address            TEXT,                    -- solo si order_type = 'delivery'
  pickup_location   TEXT,                    -- 'lagunillas' | 'salvador-allende' (solo si retiro)
  items             JSONB NOT NULL,          -- snapshot completo del carrito al momento del envío
  total             INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pendiente', -- 'pendiente' | 'completado'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
