package services

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"systemdesign/models"
)

var (
	ErrProjectNotFound    = errors.New("project not found")
	ErrForbidden          = errors.New("you do not have permission to perform this action")
	ErrNameRequired       = errors.New("project name is required")
	ErrAlreadyCollaborator = errors.New("user is already a collaborator")
	ErrCannotAddSelf      = errors.New("cannot add yourself as a collaborator")
	ErrInvalidRole        = errors.New("role must be 'editor' or 'viewer'")
)

func isOwnerOrCollaborator(db *sql.DB, userID, projectID string) (string, error) {
	var role string
	err := db.QueryRow(`SELECT 'owner' FROM projects WHERE id = $1 AND user_id = $2`, projectID, userID).Scan(&role)
	if err == nil {
		return "owner", nil
	}
	if err != sql.ErrNoRows {
		return "", err
	}

	err = db.QueryRow(`SELECT role FROM project_collaborators WHERE project_id = $1 AND user_id = $2`, projectID, userID).Scan(&role)
	if err == sql.ErrNoRows {
		return "", ErrForbidden
	}
	if err != nil {
		return "", err
	}
	return role, nil
}

func CreateProject(db *sql.DB, userID, name string, description *string, isPublic *bool) (*models.ProjectResponse, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrNameRequired
	}

	public := false
	if isPublic != nil {
		public = *isPublic
	}

	defaultCanvas := `{"nodes":[],"edges":[]}`

	var p models.Project
	err := db.QueryRow(
		`INSERT INTO projects (user_id, name, description, is_public, canvas_data, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
		 RETURNING id, user_id, name, description, is_public, created_at, updated_at`,
		userID, name, description, public, defaultCanvas, time.Now(), time.Now(),
	).Scan(&p.ID, &p.UserID, &p.Name, &p.Description, &p.IsPublic, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &models.ProjectResponse{
		ID:          p.ID,
		UserID:      p.UserID,
		Name:        p.Name,
		Description: p.Description,
		IsPublic:    p.IsPublic,
		CreatedAt:   p.CreatedAt,
		UpdatedAt:   p.UpdatedAt,
	}, nil
}

func GetProjectByID(db *sql.DB, userID, projectID string) (*models.ProjectDetailResponse, error) {
	role, err := isOwnerOrCollaborator(db, userID, projectID)
	if err != nil {
		return nil, err
	}

	var p models.Project
	err = db.QueryRow(
		`SELECT id, user_id, name, description, is_public, canvas_data, metadata, created_at, updated_at
		 FROM projects WHERE id = $1`, projectID,
	).Scan(&p.ID, &p.UserID, &p.Name, &p.Description, &p.IsPublic, &p.CanvasData, &p.Metadata, &p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, ErrProjectNotFound
	}
	if err != nil {
		return nil, err
	}

	var canvasData, metadata map[string]any
	if len(p.CanvasData) > 0 {
		json.Unmarshal(p.CanvasData, &canvasData)
	}
	if len(p.Metadata) > 0 {
		json.Unmarshal(p.Metadata, &metadata)
	}
	if canvasData == nil {
		canvasData = map[string]any{}
	}
	if metadata == nil {
		metadata = map[string]any{}
	}

	return &models.ProjectDetailResponse{
		ProjectResponse: models.ProjectResponse{
			ID:          p.ID,
			UserID:      p.UserID,
			Name:        p.Name,
			Description: p.Description,
			IsPublic:    p.IsPublic,
			CreatedAt:   p.CreatedAt,
			UpdatedAt:   p.UpdatedAt,
		},
		CanvasData: canvasData,
		Metadata:   metadata,
		Role:       role,
	}, nil
}

func ListUserProjects(db *sql.DB, userID string, page, limit int) (*models.ProjectListResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var total int
	err := db.QueryRow(
		`SELECT COUNT(DISTINCT p.id)
		 FROM projects p
		 LEFT JOIN project_collaborators pc ON pc.project_id = p.id
		 WHERE p.user_id = $1 OR pc.user_id = $1`, userID,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	rows, err := db.Query(
		`SELECT DISTINCT p.id, p.user_id, p.name, p.description, p.is_public, p.created_at, p.updated_at
		 FROM projects p
		 LEFT JOIN project_collaborators pc ON pc.project_id = p.id
		 WHERE p.user_id = $1 OR pc.user_id = $1
		 ORDER BY p.updated_at DESC
		 LIMIT $2 OFFSET $3`, userID, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []models.ProjectResponse
	for rows.Next() {
		var p models.Project
		err := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.Description, &p.IsPublic, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			return nil, err
		}
		projects = append(projects, models.ProjectResponse{
			ID:          p.ID,
			UserID:      p.UserID,
			Name:        p.Name,
			Description: p.Description,
			IsPublic:    p.IsPublic,
			CreatedAt:   p.CreatedAt,
			UpdatedAt:   p.UpdatedAt,
		})
	}
	if projects == nil {
		projects = []models.ProjectResponse{}
	}

	return &models.ProjectListResponse{
		Projects: projects,
		Total:    total,
		Page:     page,
		Limit:    limit,
	}, nil
}

func UpdateProject(db *sql.DB, userID, projectID string, req models.UpdateProjectRequest) (*models.ProjectDetailResponse, error) {
	role, err := isOwnerOrCollaborator(db, userID, projectID)
	if err != nil {
		return nil, err
	}
	if role == "viewer" {
		return nil, ErrForbidden
	}

	// Validate name if provided
	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		return nil, ErrNameRequired
	}

	var canvasJSON *string
	if req.CanvasData != nil {
		if !json.Valid([]byte(*req.CanvasData)) {
			return nil, errors.New("invalid canvas_data JSON")
		}
		s := string(*req.CanvasData)
		canvasJSON = &s
	}

	var metaJSON *string
	if req.Metadata != nil {
		if !json.Valid([]byte(*req.Metadata)) {
			return nil, errors.New("invalid metadata JSON")
		}
		s := string(*req.Metadata)
		metaJSON = &s
	}

	_, err = db.Exec(`
		UPDATE projects SET
			name = COALESCE(NULLIF($1, ''), name),
			description = COALESCE($2, description),
			is_public = COALESCE($3, is_public),
			canvas_data = COALESCE($4::jsonb, canvas_data),
			metadata = COALESCE($5::jsonb, metadata),
			updated_at = $6
		WHERE id = $7
	`, req.Name, req.Description, req.IsPublic, canvasJSON, metaJSON, time.Now(), projectID)
	if err != nil {
		return nil, err
	}

	return GetProjectByID(db, userID, projectID)
}

func SaveCanvas(db *sql.DB, userID, projectID string, canvasData []byte) (*time.Time, error) {
	role, err := isOwnerOrCollaborator(db, userID, projectID)
	if err != nil {
		return nil, err
	}
	if role == "viewer" {
		return nil, ErrForbidden
	}

	if !json.Valid(canvasData) {
		return nil, errors.New("invalid canvas_data JSON")
	}

	now := time.Now()
	_, err = db.Exec(
		`UPDATE projects SET canvas_data = $1::jsonb, updated_at = $2 WHERE id = $3`,
		canvasData, now, projectID,
	)
	if err != nil {
		return nil, err
	}

	return &now, nil
}

func DeleteProject(db *sql.DB, userID, projectID string) error {
	var ownerID string
	err := db.QueryRow(`SELECT user_id FROM projects WHERE id = $1`, projectID).Scan(&ownerID)
	if err == sql.ErrNoRows {
		return ErrProjectNotFound
	}
	if err != nil {
		return err
	}
	if ownerID != userID {
		return ErrForbidden
	}

	_, err = db.Exec(`DELETE FROM projects WHERE id = $1`, projectID)
	return err
}

func AddCollaborator(db *sql.DB, userID, projectID, email, role string) (*models.CollaboratorResponse, error) {
	if role != "editor" && role != "viewer" {
		return nil, ErrInvalidRole
	}

	var ownerID string
	err := db.QueryRow(`SELECT user_id FROM projects WHERE id = $1`, projectID).Scan(&ownerID)
	if err == sql.ErrNoRows {
		return nil, ErrProjectNotFound
	}
	if err != nil {
		return nil, err
	}
	if ownerID != userID {
		return nil, ErrForbidden
	}

	var inviteUser struct {
		ID       string
		Email    string
		Username string
	}
	err = db.QueryRow(`SELECT id, email, username FROM users WHERE email = $1`, email).Scan(&inviteUser.ID, &inviteUser.Email, &inviteUser.Username)
	if err == sql.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}

	if inviteUser.ID == userID {
		return nil, ErrCannotAddSelf
	}

	var exists int
	err = db.QueryRow(`SELECT 1 FROM project_collaborators WHERE project_id = $1 AND user_id = $2`, projectID, inviteUser.ID).Scan(&exists)
	if err == nil {
		return nil, ErrAlreadyCollaborator
	}

	var collab models.ProjectCollaborator
	err = db.QueryRow(
		`INSERT INTO project_collaborators (project_id, user_id, role, joined_at) VALUES ($1, $2, $3, $4)
		 RETURNING id, project_id, user_id, role, joined_at`,
		projectID, inviteUser.ID, role, time.Now(),
	).Scan(&collab.ID, &collab.ProjectID, &collab.UserID, &collab.Role, &collab.JoinedAt)
	if err != nil {
		return nil, err
	}

	return &models.CollaboratorResponse{
		UserID:   inviteUser.ID,
		Username: inviteUser.Username,
		Email:    inviteUser.Email,
		Role:     collab.Role,
		JoinedAt: collab.JoinedAt,
	}, nil
}

func ListCollaborators(db *sql.DB, userID, projectID string) ([]models.CollaboratorResponse, error) {
	_, err := isOwnerOrCollaborator(db, userID, projectID)
	if err != nil {
		return nil, err
	}

	rows, err := db.Query(
		`SELECT pc.user_id, u.username, u.email, pc.role, pc.joined_at
		 FROM project_collaborators pc
		 JOIN users u ON u.id = pc.user_id
		 WHERE pc.project_id = $1
		 ORDER BY pc.joined_at ASC`, projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var collaborators []models.CollaboratorResponse
	for rows.Next() {
		var c models.CollaboratorResponse
		err := rows.Scan(&c.UserID, &c.Username, &c.Email, &c.Role, &c.JoinedAt)
		if err != nil {
			return nil, err
		}
		collaborators = append(collaborators, c)
	}
	if collaborators == nil {
		collaborators = []models.CollaboratorResponse{}
	}
	return collaborators, nil
}
