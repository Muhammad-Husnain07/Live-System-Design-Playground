ALTER TABLE IF EXISTS simulation_runs ADD COLUMN IF NOT EXISTS stopped_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS simulation_runs ADD COLUMN IF NOT EXISTS results JSONB DEFAULT '{}';

CREATE TABLE IF NOT EXISTS simulation_ticks (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    tick_number INT NOT NULL,
    data JSONB NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simulation_ticks_run_id ON simulation_ticks(run_id);
CREATE INDEX IF NOT EXISTS idx_simulation_ticks_tick_number ON simulation_ticks(run_id, tick_number);
