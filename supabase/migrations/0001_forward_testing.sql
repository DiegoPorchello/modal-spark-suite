-- Forward Testing Module — Tabelas para sessões de teste em conta DEMO
-- Estratégia: Continuidade, Sorosgale Fracionado

-- ═══════════════════════════════════════════════════════════════
-- Tabela: test_sessions
-- Cada sessão representa uma rodada completa de forward testing
-- com saldo inicial, resultados agregados e métricas de performance
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE test_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,

  -- Saldo
  initial_balance DECIMAL(14,2) NOT NULL,
  final_balance   DECIMAL(14,2),
  currency        TEXT DEFAULT 'BRL',

  -- Resultados agregados
  total_operations INTEGER DEFAULT 0,
  wins             INTEGER DEFAULT 0,
  losses           INTEGER DEFAULT 0,
  draws            INTEGER DEFAULT 0,
  win_rate         DECIMAL(5,2),

  -- Performance
  net_profit      DECIMAL(14,2),
  max_drawdown    DECIMAL(14,2),
  max_consecutive_wins  INTEGER DEFAULT 0,
  max_consecutive_losses INTEGER DEFAULT 0,
  recovery_factor DECIMAL(10,2),

  -- Melhores cenários (aprendizado do motor)
  best_asset      TEXT,
  best_timeframe  TEXT,
  best_hour       INTEGER,  -- 0-23
  best_pattern    TEXT,
  avg_score       DECIMAL(5,2),

  -- Configuração da sessão
  strategy        TEXT DEFAULT 'sorosgale-fractional',
  base_entry      DECIMAL(10,2) DEFAULT 2.00,
  max_level       INTEGER DEFAULT 6,
  stop_loss       DECIMAL(14,2),
  target_profit   DECIMAL(14,2),

  -- Status
  status          TEXT DEFAULT 'running'
                    CHECK (status IN ('running','paused','completed','stopped','error')),
  started_at      TIMESTAMPTZ DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- Tabela: operations
-- Registro individual de cada operação executada durante o teste
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE operations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,

  -- Dados da operação
  asset           TEXT NOT NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('CALL','PUT')),
  amount          DECIMAL(14,2) NOT NULL,
  entry_price     DECIMAL(14,6),
  exit_price      DECIMAL(14,6),
  payout          DECIMAL(5,4),  -- ex: 0.87 = 87%
  profit          DECIMAL(14,2),
  result          TEXT CHECK (result IN ('win','loss','draw','pending')),

  -- Contexto Sorosgale
  level           INTEGER NOT NULL DEFAULT 0,
  entry_number    INTEGER NOT NULL DEFAULT 1 CHECK (entry_number IN (1,2)),

  -- Score no momento da operação
  score_at_moment DECIMAL(5,2),
  score_classification TEXT,
  filters_passed  INTEGER,
  filters_total   INTEGER,

  -- Metadados
  timeframe       TEXT NOT NULL,
  broker_order_id TEXT,
  broker_status   TEXT,
  signal_id       UUID,

  -- Timestamps
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expired_at      TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_operations_session_id ON operations(session_id);
CREATE INDEX idx_operations_asset ON operations(asset);
CREATE INDEX idx_operations_result ON operations(result);
CREATE INDEX idx_operations_opened_at ON operations(opened_at);

-- ═══════════════════════════════════════════════════════════════
-- Tabela: pattern_stats
-- Estatísticas agregadas por padrão/ativo/timeframe/horário
-- Alimenta o motor de aprendizado para ajustar scores
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE pattern_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,

  -- Cenário
  asset           TEXT NOT NULL,
  timeframe       TEXT NOT NULL,
  hour            INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  pattern_type    TEXT NOT NULL,

  -- Estatísticas
  total_signals   INTEGER DEFAULT 0,
  wins            INTEGER DEFAULT 0,
  losses          INTEGER DEFAULT 0,
  draws           INTEGER DEFAULT 0,
  win_rate        DECIMAL(5,2),
  avg_score       DECIMAL(5,2),
  avg_payout      DECIMAL(5,4),
  avg_profit      DECIMAL(14,2),
  total_profit    DECIMAL(14,2),

  -- Prioridade (aprendizado)
  priority_weight DECIMAL(3,2) DEFAULT 1.00,  -- 0.00 a 1.00
  confidence      DECIMAL(5,2),  -- 0-100
  sample_size     INTEGER DEFAULT 0,

  -- Metadados
  last_signal_at  TIMESTAMPTZ,
  first_signal_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  -- Unique: um registro por combinação sessão+ativo+timeframe+hora+padrão
  UNIQUE (session_id, asset, timeframe, hour, pattern_type)
);

CREATE INDEX idx_pattern_stats_session ON pattern_stats(session_id);
CREATE INDEX idx_pattern_stats_win_rate ON pattern_stats(win_rate DESC);
CREATE INDEX idx_pattern_stats_priority ON pattern_stats(priority_weight DESC);

-- ═══════════════════════════════════════════════════════════════
-- View: daily_report
-- Relatório diário agregado para o dashboard
-- ═══════════════════════════════════════════════════════════════
CREATE VIEW daily_report AS
SELECT
  DATE(o.opened_at) AS day,
  COUNT(*) AS total_operations,
  COUNT(*) FILTER (WHERE o.result = 'win') AS wins,
  COUNT(*) FILTER (WHERE o.result = 'loss') AS losses,
  COUNT(*) FILTER (WHERE o.result = 'draw') AS draws,
  ROUND(
    COUNT(*) FILTER (WHERE o.result = 'win')::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE o.result IN ('win','loss')), 0) * 100, 2
  ) AS win_rate,
  COALESCE(SUM(o.profit), 0) AS net_profit,
  COALESCE(AVG(o.score_at_moment), 0) AS avg_score,
  COUNT(DISTINCT o.asset) AS assets_traded,
  COUNT(DISTINCT o.session_id) AS active_sessions
FROM operations o
WHERE o.result != 'pending'
GROUP BY DATE(o.opened_at)
ORDER BY day DESC;

-- ═══════════════════════════════════════════════════════════════
-- View: asset_ranking
-- Ranking de ativos por performance real
-- ═══════════════════════════════════════════════════════════════
CREATE VIEW asset_ranking AS
SELECT
  o.asset,
  COUNT(*) AS total_ops,
  COUNT(*) FILTER (WHERE o.result = 'win') AS wins,
  COUNT(*) FILTER (WHERE o.result = 'loss') AS losses,
  ROUND(
    COUNT(*) FILTER (WHERE o.result = 'win')::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE o.result IN ('win','loss')), 0) * 100, 2
  ) AS win_rate,
  COALESCE(SUM(o.profit), 0) AS total_profit,
  COALESCE(AVG(o.score_at_moment), 0) AS avg_score,
  COUNT(DISTINCT DATE(o.opened_at)) AS days_traded,
  MAX(o.opened_at) AS last_trade_at
FROM operations o
WHERE o.result != 'pending'
GROUP BY o.asset
ORDER BY win_rate DESC, total_profit DESC;

-- ═══════════════════════════════════════════════════════════════
-- View: hourly_performance
-- Performance por horário do dia (aprendizado do motor)
-- ═══════════════════════════════════════════════════════════════
CREATE VIEW hourly_performance AS
SELECT
  EXTRACT(HOUR FROM o.opened_at)::INT AS hour,
  COUNT(*) AS total_ops,
  COUNT(*) FILTER (WHERE o.result = 'win') AS wins,
  ROUND(
    COUNT(*) FILTER (WHERE o.result = 'win')::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE o.result IN ('win','loss')), 0) * 100, 2
  ) AS win_rate,
  COALESCE(SUM(o.profit), 0) AS total_profit,
  COALESCE(AVG(o.score_at_moment), 0) AS avg_score
FROM operations o
WHERE o.result != 'pending'
GROUP BY EXTRACT(HOUR FROM o.opened_at)
ORDER BY hour;

-- ═══════════════════════════════════════════════════════════════
-- View: best_timeframes
-- Melhores timeframes ranqueados
-- ═══════════════════════════════════════════════════════════════
CREATE VIEW best_timeframes AS
SELECT
  o.timeframe,
  COUNT(*) AS total_ops,
  COUNT(*) FILTER (WHERE o.result = 'win') AS wins,
  ROUND(
    COUNT(*) FILTER (WHERE o.result = 'win')::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE o.result IN ('win','loss')), 0) * 100, 2
  ) AS win_rate,
  COALESCE(SUM(o.profit), 0) AS total_profit,
  COALESCE(AVG(o.score_at_moment), 0) AS avg_score
FROM operations o
WHERE o.result != 'pending'
GROUP BY o.timeframe
ORDER BY win_rate DESC;

-- ═══════════════════════════════════════════════════════════════
-- Function: update_session_stats()
-- Atualiza os agregados da sessão quando uma operação é inserida
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_session_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE test_sessions SET
    total_operations = (SELECT COUNT(*) FROM operations WHERE session_id = NEW.session_id AND result != 'pending'),
    wins             = (SELECT COUNT(*) FROM operations WHERE session_id = NEW.session_id AND result = 'win'),
    losses           = (SELECT COUNT(*) FROM operations WHERE session_id = NEW.session_id AND result = 'loss'),
    draws            = (SELECT COUNT(*) FROM operations WHERE session_id = NEW.session_id AND result = 'draw'),
    win_rate         = ROUND(
      (SELECT COUNT(*) FROM operations WHERE session_id = NEW.session_id AND result = 'win')::DECIMAL /
      NULLIF((SELECT COUNT(*) FROM operations WHERE session_id = NEW.session_id AND result IN ('win','loss')), 0) * 100, 2
    ),
    net_profit       = (SELECT COALESCE(SUM(profit), 0) FROM operations WHERE session_id = NEW.session_id),
    updated_at       = now()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_session_stats
  AFTER INSERT OR UPDATE OF result ON operations
  FOR EACH ROW
  WHEN (NEW.result != 'pending')
  EXECUTE FUNCTION update_session_stats();

-- ═══════════════════════════════════════════════════════════════
-- Function: upsert_pattern_stats()
-- Atualiza ou insere estatísticas de padrão após cada operação
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION upsert_pattern_stats()
RETURNS TRIGGER AS $$
DECLARE
  trade_hour INT;
BEGIN
  trade_hour := EXTRACT(HOUR FROM NEW.opened_at)::INT;

  INSERT INTO pattern_stats (
    session_id, asset, timeframe, hour, pattern_type,
    total_signals, wins, losses, draws, win_rate,
    avg_score, avg_payout, avg_profit, total_profit,
    priority_weight, confidence, sample_size,
    last_signal_at, first_signal_at
  ) VALUES (
    NEW.session_id, NEW.asset, NEW.timeframe, trade_hour,
    COALESCE(NEW.score_classification, 'unknown'),
    1,
    CASE WHEN NEW.result = 'win' THEN 1 ELSE 0 END,
    CASE WHEN NEW.result = 'loss' THEN 1 ELSE 0 END,
    CASE WHEN NEW.result = 'draw' THEN 1 ELSE 0 END,
    CASE WHEN NEW.result = 'win' THEN 100 ELSE 0 END,
    COALESCE(NEW.score_at_moment, 0),
    COALESCE(NEW.payout, 0),
    COALESCE(NEW.profit, 0),
    COALESCE(NEW.profit, 0),
    1.00,
    CASE WHEN NEW.result = 'win' THEN 100 ELSE 0 END,
    1,
    NEW.opened_at,
    NEW.opened_at
  )
  ON CONFLICT (session_id, asset, timeframe, hour, pattern_type)
  DO UPDATE SET
    total_signals = pattern_stats.total_signals + 1,
    wins         = pattern_stats.wins + CASE WHEN NEW.result = 'win' THEN 1 ELSE 0 END,
    losses       = pattern_stats.losses + CASE WHEN NEW.result = 'loss' THEN 1 ELSE 0 END,
    draws        = pattern_stats.draws + CASE WHEN NEW.result = 'draw' THEN 1 ELSE 0 END,
    win_rate     = ROUND(
      (pattern_stats.wins + CASE WHEN NEW.result = 'win' THEN 1 ELSE 0 END)::DECIMAL /
      NULLIF(
        pattern_stats.wins + pattern_stats.losses +
        CASE WHEN NEW.result = 'win' THEN 1 ELSE 0 END +
        CASE WHEN NEW.result = 'loss' THEN 1 ELSE 0 END, 0
      ) * 100, 2
    ),
    avg_score    = ROUND(
      (pattern_stats.avg_score * pattern_stats.total_signals + COALESCE(NEW.score_at_moment, 0)) /
      (pattern_stats.total_signals + 1), 2
    ),
    avg_payout   = ROUND(
      (pattern_stats.avg_payout * pattern_stats.total_signals + COALESCE(NEW.payout, 0)) /
      (pattern_stats.total_signals + 1), 4
    ),
    avg_profit   = ROUND(
      (pattern_stats.avg_profit * pattern_stats.total_signals + COALESCE(NEW.profit, 0)) /
      (pattern_stats.total_signals + 1), 2
    ),
    total_profit = pattern_stats.total_profit + COALESCE(NEW.profit, 0),
    sample_size  = pattern_stats.sample_size + 1,
    last_signal_at = NEW.opened_at,
    updated_at   = now(),
    -- Aprendizado: ajusta priority_weight baseado na confiança
    priority_weight = ROUND(
      LEAST(
        (pattern_stats.wins + CASE WHEN NEW.result = 'win' THEN 1 ELSE 0 END)::DECIMAL /
        NULLIF(pattern_stats.total_signals + 1, 0) * 1.5, 1.00
      ), 2
    ),
    confidence   = ROUND(
      CASE
        WHEN pattern_stats.total_signals + 1 >= 10
        THEN (pattern_stats.wins + CASE WHEN NEW.result = 'win' THEN 1 ELSE 0 END)::DECIMAL /
             NULLIF(pattern_stats.total_signals + 1, 0) * 100
        ELSE (pattern_stats.wins + CASE WHEN NEW.result = 'win' THEN 1 ELSE 0 END)::DECIMAL /
             NULLIF(pattern_stats.total_signals + 1, 0) * 100 * 0.5  -- penalidade para amostras pequenas
      END, 2
    )
  WHERE pattern_stats.session_id = NEW.session_id
    AND pattern_stats.asset = NEW.asset
    AND pattern_stats.timeframe = NEW.timeframe
    AND pattern_stats.hour = trade_hour
    AND pattern_stats.pattern_type = COALESCE(NEW.score_classification, 'unknown');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_upsert_pattern_stats
  AFTER INSERT OR UPDATE OF result ON operations
  FOR EACH ROW
  WHEN (NEW.result != 'pending')
  EXECUTE FUNCTION upsert_pattern_stats();

-- ═══════════════════════════════════════════════════════════════
-- Enable Row Level Security (opcional — liberado para o serviço)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on test_sessions" ON test_sessions FOR ALL USING (true);
CREATE POLICY "Allow all on operations" ON operations FOR ALL USING (true);
CREATE POLICY "Allow all on pattern_stats" ON pattern_stats FOR ALL USING (true);
