-- ML model cache: persists trained LR weights per workspace so brain rebuilds
-- can skip retraining when the closed-deal set hasn't changed.
CREATE TABLE IF NOT EXISTS workspace_ml_models (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      TEXT        NOT NULL,
  model_type        TEXT        NOT NULL DEFAULT 'win_probability',
  weights           JSONB       NOT NULL, -- { coefficients: number[], bias: number, featureNames: string[] }
  training_size     INTEGER     NOT NULL,
  accuracy          NUMERIC(5,4),
  last_trained_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_deals_hash TEXT,                 -- SHA of sorted closed deal IDs; NULL = always retrain
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, model_type)
);

CREATE INDEX IF NOT EXISTS idx_workspace_ml_models_workspace
  ON workspace_ml_models(workspace_id);
