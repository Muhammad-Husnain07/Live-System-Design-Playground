CREATE TABLE challenge_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    score FLOAT DEFAULT 0,
    passed BOOLEAN DEFAULT false,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_submissions_challenge_id ON challenge_submissions(challenge_id);
CREATE INDEX idx_submissions_user_id ON challenge_submissions(user_id);
CREATE INDEX idx_submissions_passed ON challenge_submissions(passed);
