-- ============================================================================
-- EMPAPADOS — Migración v6: Inventario por sucursal
-- Ejecutar en el SQL Editor de Neon (una sola vez).
-- ============================================================================

-- Insumos/productos de inventario, uno por sucursal (ej. "Pan de Completo" en
-- Lagunillas es una fila distinta de "Pan de Completo" en Salvador Allende,
-- para poder llevar stock independiente por local).
CREATE TABLE IF NOT EXISTS inventory_items (
  id             SERIAL PRIMARY KEY,
  branch_id      TEXT NOT NULL REFERENCES branches(id),
  name           TEXT NOT NULL,
  unit           TEXT NOT NULL DEFAULT 'unidad',
  quantity       NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_threshold  NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, name)
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_branch ON inventory_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_active ON inventory_items(active);

-- Historial de movimientos de stock (entradas, salidas, ajustes), para poder
-- ver quién/cuándo cambió el stock y por qué, igual que cash_movements.
CREATE TABLE IF NOT EXISTS inventory_movements (
  id                  SERIAL PRIMARY KEY,
  item_id             INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  branch_id           TEXT NOT NULL REFERENCES branches(id),
  type                TEXT NOT NULL CHECK (type IN ('entrada', 'salida', 'ajuste')),
  quantity            NUMERIC(12,2) NOT NULL,
  resulting_quantity  NUMERIC(12,2) NOT NULL,
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_branch_created
  ON inventory_movements(branch_id, created_at DESC);

-- Carga los insumos más relevantes para ambas sucursales, con stock en 0
-- (edítalos desde /admin/inventario para cargar el stock real y el mínimo
-- que quieras usar como alerta de stock bajo).
INSERT INTO inventory_items (branch_id, name, unit, quantity, min_threshold) VALUES
  ('lagunillas', 'Pan de Completo', 'unidad', 0, 20),
  ('lagunillas', 'Pan de Sándwich', 'unidad', 0, 20),
  ('lagunillas', 'Pan de Hamburguesa', 'unidad', 0, 20),
  ('lagunillas', 'Salchichas', 'unidad', 0, 20),
  ('lagunillas', 'Papas', 'kg', 0, 5),
  ('lagunillas', 'Carne', 'kg', 0, 5),
  ('lagunillas', 'Pollo', 'kg', 0, 5),
  ('lagunillas', 'Envases Box', 'unidad', 0, 30),
  ('salvador-allende', 'Pan de Completo', 'unidad', 0, 20),
  ('salvador-allende', 'Pan de Sándwich', 'unidad', 0, 20),
  ('salvador-allende', 'Pan de Hamburguesa', 'unidad', 0, 20),
  ('salvador-allende', 'Salchichas', 'unidad', 0, 20),
  ('salvador-allende', 'Papas', 'kg', 0, 5),
  ('salvador-allende', 'Carne', 'kg', 0, 5),
  ('salvador-allende', 'Pollo', 'kg', 0, 5),
  ('salvador-allende', 'Envases Box', 'unidad', 0, 30)
ON CONFLICT (branch_id, name) DO NOTHING;

-- ============================================================================
-- FIN — Ahora /admin/inventario está disponible en el panel.
-- ============================================================================
