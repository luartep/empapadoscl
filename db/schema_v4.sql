-- ============================================================================
-- EMPAPADOS — Migración v4: Aceptar / Cancelar pedidos
-- Ejecutar en el SQL Editor de Neon (una sola vez).
-- ============================================================================

-- Agrega el campo "accepted" para saber si el pedido fue aceptado por cocina.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted BOOLEAN NOT NULL DEFAULT false;

-- Agrega el campo de cancelación. Si status = 'cancelado', este campo tiene el motivo.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Actualiza los valores por defecto de pedidos nuevos:
-- Los pedidos ya existentes quedan con accepted = false (sin cambio visible).

-- Índice para filtrar cancelados rápido
CREATE INDEX IF NOT EXISTS idx_orders_status_cancel ON orders(status) WHERE status = 'cancelado';

-- ============================================================================
-- FIN — Ahora el panel muestra botones Aceptar y Cancelar en cada pedido.
-- ============================================================================
