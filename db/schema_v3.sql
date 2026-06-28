-- ============================================================================
-- Migración 3: Estados de pago y preparación para pedidos.
-- Ejecutar UNA SOLA VEZ, después de schema.sql, seed.sql y schema_v2.sql.
-- ============================================================================

-- Estado de preparación del pedido (reemplaza el uso del viejo "status"
-- pendiente/completado con algo más expresivo para el flujo de cocina).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prep_status TEXT NOT NULL DEFAULT 'en_preparacion';
-- Valores: 'en_preparacion' | 'en_reparto' | 'entregado'

-- Estado y medio de pago, independientes del estado de preparación
-- (un pedido puede estar entregado y todavía no pagado, por ejemplo).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pendiente';
-- Valores: 'pendiente' | 'pagado'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
-- Valores: 'efectivo' | 'tarjeta' | 'transferencia' (solo cuando payment_status = 'pagado')
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Vincula el pedido a la venta de caja que se generó al marcarlo como
-- pagado (para no contarlo dos veces si se desmarca/remarca, y para que
-- el arqueo pueda rastrear de dónde vino cada venta).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_sale_id INTEGER REFERENCES manual_sales(id);

-- Migra los datos existentes: lo que antes era status='completado' pasa a
-- ser prep_status='entregado'; el resto queda 'en_preparacion'. No se
-- toca el pago (queda 'pendiente' por defecto, ya que no había ese dato antes).
UPDATE orders SET prep_status = 'entregado' WHERE status = 'completado';

CREATE INDEX IF NOT EXISTS idx_orders_prep_status ON orders(prep_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
