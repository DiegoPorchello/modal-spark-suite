-- Copy Trader Module — Contas para replicação de operações
-- Permite gerenciar contas secundárias que copiam automaticamente
-- as operações executadas na conta principal

CREATE TABLE copy_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label         TEXT NOT NULL,
  email         TEXT NOT NULL,
  is_demo       BOOLEAN DEFAULT TRUE,
  active        BOOLEAN DEFAULT TRUE,
  last_error    TEXT,
  last_sync_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE copy_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on copy_accounts"
  ON copy_accounts
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_copy_accounts_email ON copy_accounts (email);
CREATE INDEX idx_copy_accounts_active ON copy_accounts (active);
