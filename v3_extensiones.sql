-- ============================================================
-- POS v3 — TIPO DE ORDEN + DESCUENTOS AVANZADOS + NOTIFICACIONES
-- Ejecutar después de pos_schema.sql y v2_comandas.sql
-- ============================================================

-- Tipos de orden en ventas (agregar columnas)
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS tipo_orden   TEXT NOT NULL DEFAULT 'retiro'
    CHECK (tipo_orden IN ('retiro', 'delivery')),
  ADD COLUMN IF NOT EXISTS cliente_nombre TEXT,
  ADD COLUMN IF NOT EXISTS cliente_telefono TEXT,
  ADD COLUMN IF NOT EXISTS direccion_entrega TEXT,
  ADD COLUMN IF NOT EXISTS numero_correlativo INTEGER; -- número visible para el cliente

-- Secuencia de correlativos diarios (se resetea manualmente o con cron)
CREATE SEQUENCE IF NOT EXISTS correlativo_diario START 1;

-- Descuentos configurables
CREATE TABLE IF NOT EXISTS descuentos (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('porcentaje', 'monto_fijo', 'producto')),
  valor       NUMERIC(10,2) NOT NULL,  -- % o CLP
  codigo      TEXT UNIQUE,             -- código de cupón opcional
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  usos        INTEGER NOT NULL DEFAULT 0,
  max_usos    INTEGER,                 -- null = ilimitado
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notificaciones de cocina → caja
CREATE TABLE IF NOT EXISTS notificaciones (
  id          SERIAL PRIMARY KEY,
  tipo        TEXT NOT NULL CHECK (tipo IN ('orden_lista', 'orden_demorada', 'stock_bajo', 'sistema')),
  titulo      TEXT NOT NULL,
  mensaje     TEXT,
  referencia  TEXT,   -- numero_orden o id relacionado
  leida       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ventas_tipo_orden ON ventas(tipo_orden);
CREATE INDEX IF NOT EXISTS idx_ventas_correlativo ON ventas(numero_correlativo);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida ON notificaciones(leida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_descuentos_codigo ON descuentos(codigo) WHERE codigo IS NOT NULL;

-- ── Datos de ejemplo ──────────────────────────────────────────

INSERT INTO descuentos (nombre, tipo, valor, codigo) VALUES
  ('Descuento empleado',    'porcentaje',  20,    'STAFF20'),
  ('Descuento 10%',         'porcentaje',  10,    NULL),
  ('Descuento $500',        'monto_fijo',  500,   NULL),
  ('Promoción mediodía',    'porcentaje',  15,    'LUNCH15'),
  ('Cupón especial',        'monto_fijo',  1000,  'PROMO1K')
ON CONFLICT DO NOTHING;
