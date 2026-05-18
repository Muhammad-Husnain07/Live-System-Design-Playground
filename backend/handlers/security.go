package handlers

import (
	"database/sql"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"systemdesign/services/security"
)

type SecurityHandler struct {
	DB    *sql.DB
	Redis *redis.Client
}

func NewSecurityHandler(db *sql.DB, rdb *redis.Client) *SecurityHandler {
	return &SecurityHandler{DB: db, Redis: rdb}
}

type auditRequest struct {
	ProjectID string `json:"projectId"`
}

func (h *SecurityHandler) Audit(c *fiber.Ctx) error {
	var req auditRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.ProjectID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "projectId is required"})
	}

	userID := c.Locals("user_id")
	if userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}

	var role string
	err := h.DB.QueryRow(
		`SELECT 'owner' FROM projects WHERE id = $1 AND user_id = $2`,
		req.ProjectID, userID,
	).Scan(&role)
	if err != nil {
		err = h.DB.QueryRow(
			`SELECT role FROM project_collaborators WHERE project_id = $1 AND user_id = $2`,
			req.ProjectID, userID,
		).Scan(&role)
		if err != nil {
			return c.Status(403).JSON(fiber.Map{"error": "project not found or access denied"})
		}
	}

	var canvasRaw []byte
	err = h.DB.QueryRow(
		`SELECT canvas_data FROM projects WHERE id = $1`, req.ProjectID,
	).Scan(&canvasRaw)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to read project data"})
	}

	graph, err := security.ParseCanvasData(canvasRaw)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to parse canvas data: " + err.Error()})
	}

	auditor := security.NewSecurityAuditor(graph)
	violations := auditor.Audit()

	return c.JSON(fiber.Map{"violations": violations})
}
