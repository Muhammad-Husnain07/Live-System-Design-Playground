CREATE TABLE IF NOT EXISTS simulation_runs (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    config JSONB NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stopped_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'running'
);

CREATE INDEX IF NOT EXISTS idx_simulation_runs_project_id ON simulation_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_user_id ON simulation_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_status ON simulation_runs(status);

CREATE TABLE IF NOT EXISTS simulation_ticks (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    tick_number INT NOT NULL,
    data JSONB NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simulation_ticks_run_id ON simulation_ticks(run_id);
CREATE INDEX IF NOT EXISTS idx_simulation_ticks_tick_number ON simulation_ticks(run_id, tick_number);
