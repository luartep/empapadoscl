-- ============================================================================
-- Migración 2: Gestión multisucursal y financiera (turnos de caja, arqueos,
-- movimientos manuales). Ejecutar UNA SOLA VEZ, después de schema.sql y
-- seed.sql (no los reemplaza, los complementa).
-- ============================================================================

-- --------------------------- Sucursales ---------------------------

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

-- Vincula cada pedido del menú web a la sucursal que lo debe atender.
-- Por defecto queda NULL (sin asignar) hasta que el admin lo asigna desde
-- el panel; los pedidos restringidos (Sandwich/Completos) se pre-asignan
-- a Salvador Allende automáticamente al guardarse.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);

-- --------------------------- Turnos de caja ---------------------------

-- Un turno = el período entre que un cajero abre caja (con un monto inicial
-- de efectivo) y la cierra (arqueo). Todas las ventas y movimientos de caja
-- de ese período quedan asociados a este turno.
CREATE TABLE IF NOT EXISTS cash_shifts (
  id                  SERIAL PRIMARY KEY,
  branch_id           TEXT NOT NULL REFERENCES branches(id),
  opened_by           TEXT NOT NULL DEFAULT 'gino',
  opening_cash        INTEGER NOT NULL DEFAULT 0,
  opened_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  status              TEXT NOT NULL DEFAULT 'abierto', -- 'abierto' | 'cerrado'

  -- Tipo de arqueo elegido al cerrar: 'normal' (el cajero ve el monto
  -- esperado mientras cuenta) o 'ciego' (cuenta primero, sin ver el
  -- esperado, y el sistema revela la diferencia después de que confirma).
  closing_type        TEXT,

  -- Conteo físico declarado por el cajero al cerrar, por medio de pago.
  counted_cash        INTEGER,
  counted_card        INTEGER,
  counted_transfer    INTEGER,

  -- Montos esperados calculados por el sistema al momento del cierre
  -- (ventas registradas + movimientos manuales de ese turno).
  expected_cash       INTEGER,
  expected_card       INTEGER,
  expected_transfer   INTEGER,

  notes               TEXT,
  closed_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cash_shifts_branch ON cash_shifts(branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_status ON cash_shifts(status);

-- Solo puede existir UN turno abierto a la vez por sucursal (una caja por
-- local, como confirmaste). Este índice único parcial lo garantiza a nivel
-- de base de datos, evitando abrir dos turnos simultáneos por error.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_shift_per_branch
  ON cash_shifts(branch_id)
  WHERE status = 'abierto';

-- --------------------------- Movimientos de caja manuales ---------------------------

-- Ingresos/egresos que NO son ventas (ej. "compré hielo, saqué $5.000",
-- "aporte de caja chica"). Siempre asociados a un turno abierto.
CREATE TABLE IF NOT EXISTS cash_movements (
  id            SERIAL PRIMARY KEY,
  shift_id      INTEGER NOT NULL REFERENCES cash_shifts(id),
  branch_id     TEXT NOT NULL REFERENCES branches(id),
  type          TEXT NOT NULL,        -- 'ingreso' | 'egreso'
  amount        INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'efectivo', -- 'efectivo' | 'tarjeta' | 'transferencia'
  description   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_shift ON cash_movements(shift_id);

-- --------------------------- Ventas registradas manualmente ---------------------------

-- Para que el arqueo tenga ventas que contrastar mientras el POS de
-- mostrador no existe todavía: ventas que el cajero registra a mano
-- desde el panel (monto + medio de pago), asociadas al turno abierto.
-- A futuro, cuando se construya el POS de mostrador, esas ventas también
-- alimentarán esta misma tabla.
CREATE TABLE IF NOT EXISTS manual_sales (
  id              SERIAL PRIMARY KEY,
  shift_id        INTEGER NOT NULL REFERENCES cash_shifts(id),
  branch_id       TEXT NOT NULL REFERENCES branches(id),
  amount          INTEGER NOT NULL,
  payment_method  TEXT NOT NULL, -- 'efectivo' | 'tarjeta' | 'transferencia'
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_sales_shift ON manual_sales(shift_id);
