package models

import (
	"encoding/json"
	"time"
)

type Project struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	IsPublic    bool      `json:"is_public"`
	CanvasData  []byte    `json:"-"`
	Metadata    []byte    `json:"-"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ProjectResponse struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	IsPublic    bool      `json:"is_public"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ProjectDetailResponse struct {
	ProjectResponse
	CanvasData map[string]any `json:"canvas_data"`
	Metadata   map[string]any `json:"metadata"`
	Role       string         `json:"role"`
}

type CreateProjectRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	IsPublic    *bool   `json:"is_public"`
}

type UpdateProjectRequest struct {
	Name        *string          `json:"name"`
	Description *string          `json:"description"`
	IsPublic    *bool            `json:"is_public"`
	CanvasData  *json.RawMessage `json:"canvas_data"`
	Metadata    *json.RawMessage `json:"metadata"`
}

type SaveCanvasRequest struct {
	CanvasData json.RawMessage `json:"canvas_data"`
}

type AddCollaboratorRequest struct {
	Email string `json:"email"`
	Role  string `json:"role"`
}

type ProjectCollaborator struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"project_id"`
	UserID    string    `json:"user_id"`
	Role      string    `json:"role"`
	JoinedAt  time.Time `json:"joined_at"`
}

type CollaboratorResponse struct {
	UserID    string    `json:"user_id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	JoinedAt  time.Time `json:"joined_at"`
}

type ProjectListResponse struct {
	Projects []ProjectResponse `json:"projects"`
	Total    int               `json:"total"`
	Page     int               `json:"page"`
	Limit    int               `json:"limit"`
}
