-- ============================================================================
-- EMPAPADOS — SQL COMPLETO
-- Ejecutar TODO este archivo de una sola vez en Neon (SQL Editor).
-- Incluye: schema base, sucursales, caja, migraciones v2 y v3.
-- NO incluye seed.sql (los productos). Ejecutar seed.sql por separado.
-- ============================================================================

-- ================================
-- 1. TABLAS BASE (schema.sql)
-- ================================

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

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id                SERIAL PRIMARY KEY,
  customer_name     TEXT NOT NULL,
  order_type        TEXT NOT NULL,
  address           TEXT,
  pickup_location   TEXT,
  items             JSONB NOT NULL,
  total             INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pendiente',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- ================================
-- 2. SUCURSALES Y CAJA (schema_v2.sql)
-- ================================

CREATE TABLE IF NOT EXISTS branches (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO branches (id, name) VALUES
  ('lagunillas', 'Lagunillas'),
  ('salvador-allende', 'Salvador Allende')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);

CREATE TABLE IF NOT EXISTS cash_shifts (
  id                  SERIAL PRIMARY KEY,
  branch_id           TEXT NOT NULL REFERENCES branches(id),
  opened_by           TEXT NOT NULL DEFAULT 'gino',
  opening_cash        INTEGER NOT NULL DEFAULT 0,
  opened_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  status              TEXT NOT NULL DEFAULT 'abierto',
  closing_type        TEXT,
  counted_cash        INTEGER,
  counted_card        INTEGER,
  counted_transfer    INTEGER,
  expected_cash       INTEGER,
  expected_card       INTEGER,
  expected_transfer   INTEGER,
  notes               TEXT,
  closed_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cash_shifts_branch ON cash_shifts(branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_status ON cash_shifts(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_shift_per_branch
  ON cash_shifts(branch_id)
  WHERE status = 'abierto';

CREATE TABLE IF NOT EXISTS cash_movements (
  id             SERIAL PRIMARY KEY,
  shift_id       INTEGER NOT NULL REFERENCES cash_shifts(id),
  branch_id      TEXT NOT NULL REFERENCES branches(id),
  type           TEXT NOT NULL,
  amount         INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'efectivo',
  description    TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_shift ON cash_movements(shift_id);

CREATE TABLE IF NOT EXISTS manual_sales (
  id              SERIAL PRIMARY KEY,
  shift_id        INTEGER NOT NULL REFERENCES cash_shifts(id),
  branch_id       TEXT NOT NULL REFERENCES branches(id),
  amount          INTEGER NOT NULL,
  payment_method  TEXT NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_sales_shift ON manual_sales(shift_id);

-- ================================
-- 3. ESTADOS DE PAGO (schema_v3.sql)
-- ================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS prep_status TEXT NOT NULL DEFAULT 'en_preparacion';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pendiente';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_sale_id INTEGER REFERENCES manual_sales(id);

UPDATE orders SET prep_status = 'entregado' WHERE status = 'completado';

CREATE INDEX IF NOT EXISTS idx_orders_prep_status ON orders(prep_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- ============================================================================
-- FIN — Ahora ejecuta seed.sql por separado para cargar los productos.
-- ============================================================================
