package models

import (
	"encoding/json"
	"time"
)

type Challenge struct {
	ID               string          `json:"id"`
	Title            string          `json:"title"`
	Description      string          `json:"description"`
	Difficulty       string          `json:"difficulty"`
	Requirements     json.RawMessage `json:"requirements"`
	InitialCanvas    json.RawMessage `json:"initial_canvas"`
	TimeLimitSeconds int             `json:"time_limit_seconds"`
	PassingCriteria  json.RawMessage `json:"passing_criteria"`
	CreatedAt        time.Time       `json:"created_at"`
}

type ChallengeSubmission struct {
	ID          string    `json:"id"`
	ChallengeID string    `json:"challenge_id"`
	UserID      string    `json:"user_id"`
	ProjectID   string    `json:"project_id"`
	Score       float64   `json:"score"`
	Passed      bool      `json:"passed"`
	SubmittedAt time.Time `json:"submitted_at"`
}

type ChallengeResponse struct {
	ID               string          `json:"id"`
	Title            string          `json:"title"`
	Description      string          `json:"description"`
	Difficulty       string          `json:"difficulty"`
	Requirements     json.RawMessage `json:"requirements"`
	InitialCanvas    json.RawMessage `json:"initial_canvas"`
	TimeLimitSeconds int             `json:"timeLimitSeconds"`
	PassingCriteria  json.RawMessage `json:"passingCriteria"`
}

type ScoreBreakdown struct {
	Cost         float64 `json:"cost"`
	Reliability  float64 `json:"reliability"`
	Performance  float64 `json:"performance"`
	Total        float64 `json:"total"`
	Passed       bool    `json:"passed"`
}

type LeaderboardEntry struct {
	Rank       int     `json:"rank"`
	Username   string  `json:"username"`
	Score      float64 `json:"score"`
	Passed     bool    `json:"passed"`
	SubmittedAt string `json:"submittedAt"`
}

type SubmitRequest struct {
	ProjectID string `json:"projectId"`
}

type DrillStartRequest struct {
	ProjectID string `json:"projectId"`
	Scenario  string `json:"scenario"`
}
