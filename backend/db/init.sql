CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    canvas_data JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_public ON projects(is_public);

CREATE TABLE IF NOT EXISTS project_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'viewer',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_collaborators_project_id ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user_id ON project_collaborators(user_id);

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

CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    difficulty VARCHAR(50) DEFAULT 'medium',
    requirements JSONB NOT NULL,
    initial_canvas JSONB DEFAULT '{}',
    time_limit_seconds INT DEFAULT 1800,
    passing_criteria JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenges_difficulty ON challenges(difficulty);

CREATE TABLE IF NOT EXISTS challenge_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    score FLOAT DEFAULT 0,
    passed BOOLEAN DEFAULT false,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_challenge_id ON challenge_submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON challenge_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_passed ON challenge_submissions(passed);
