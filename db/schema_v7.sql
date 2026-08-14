-- ============================================================================
-- EMPAPADOS — Migración v7: Recetas de productos
-- Ejecutar en el SQL Editor de Neon (una sola vez).
-- Vincula cada producto con los insumos de inventario que consume,
-- para que al confirmar un pedido se descuenten automáticamente.
-- ============================================================================

-- Tabla de recetas: cada fila = 1 insumo que consume 1 producto
-- La receta es global (no por sucursal): la búsqueda del insumo a descontar
-- se hace por nombre dentro de la sucursal donde se origina el pedido.
CREATE TABLE IF NOT EXISTS product_recipes (
  id            SERIAL PRIMARY KEY,
  product_id    TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  item_name     TEXT NOT NULL,   -- nombre del inventory_item (se busca por nombre en la sucursal)
  quantity      NUMERIC(12,2) NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, item_name)
);

CREATE INDEX IF NOT EXISTS idx_product_recipes_product ON product_recipes(product_id);

-- ============================================================================
-- FIN — Ahora /admin/recipes está disponible para configurar las recetas.
-- ============================================================================
