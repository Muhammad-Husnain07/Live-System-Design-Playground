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
