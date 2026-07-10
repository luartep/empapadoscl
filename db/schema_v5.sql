-- ============================================================================
-- EMPAPADOS — Migración v5: Índices para Reportes
-- Ejecutar en el SQL Editor de Neon (una sola vez).
-- ============================================================================

-- Índice sobre paid_at para acelerar todos los reportes de ventas por período.
-- Las consultas de reportes filtran siempre por payment_status='pagado' y
-- rangos de fecha, así que este índice parcial cubre exactamente ese patrón.
CREATE INDEX IF NOT EXISTS idx_orders_paid_at
  ON orders(paid_at DESC)
  WHERE payment_status = 'pagado';

-- Índice compuesto para reportes por sucursal + período.
CREATE INDEX IF NOT EXISTS idx_orders_branch_paid
  ON orders(branch_id, paid_at DESC)
  WHERE payment_status = 'pagado';

-- Índice para reportes por medio de pago.
CREATE INDEX IF NOT EXISTS idx_orders_payment_method
  ON orders(payment_method)
  WHERE payment_status = 'pagado';

-- Índice para historial de turnos cerrados por sucursal.
CREATE INDEX IF NOT EXISTS idx_cash_shifts_closed
  ON cash_shifts(branch_id, opened_at DESC)
  WHERE status = 'cerrado';

-- ============================================================================
-- FIN — Ahora /admin/reports está disponible en el panel.
-- ============================================================================
