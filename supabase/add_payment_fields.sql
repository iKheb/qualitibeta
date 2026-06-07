-- Agregar columnas para abono y metodo de pago a la tabla repairs
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS abono NUMERIC DEFAULT 0;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS metodo_pago TEXT;
