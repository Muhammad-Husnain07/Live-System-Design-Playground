CREATE TABLE IF NOT EXISTS chaos_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_run_id UUID NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    target_node_id VARCHAR(255),
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duration_seconds INT,
    config JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_chaos_events_simulation_run_id ON chaos_events(simulation_run_id);
CREATE INDEX IF NOT EXISTS idx_chaos_events_event_type ON chaos_events(event_type);
