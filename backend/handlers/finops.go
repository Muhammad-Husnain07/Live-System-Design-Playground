package handlers

import (
	"database/sql"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"systemdesign/config"
	"systemdesign/services/finops"
)

type FinOpsHandler struct {
	DB    *sql.DB
	Redis *redis.Client
}

func NewFinOpsHandler(db *sql.DB, rdb *redis.Client) *FinOpsHandler {
	return &FinOpsHandler{DB: db, Redis: rdb}
}

type estimateRequest struct {
	ProjectID    string `json:"projectId"`
	MonthlyUsers int    `json:"monthlyUsers"`
}

func (h *FinOpsHandler) Estimate(c *fiber.Ctx) error {
	var req estimateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.ProjectID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "projectId is required"})
	}
	if req.MonthlyUsers <= 0 {
		req.MonthlyUsers = 1000
	}

	claims, ok := c.Locals("user").(*config.JWTClaims)
	if !ok || claims.UserID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}

	var role string
	err := h.DB.QueryRow(
		`SELECT 'owner' FROM projects WHERE id = $1 AND user_id = $2`,
		req.ProjectID, claims.UserID,
	).Scan(&role)
	if err != nil {
		err = h.DB.QueryRow(
			`SELECT role FROM project_collaborators WHERE project_id = $1 AND user_id = $2`,
			req.ProjectID, claims.UserID,
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

	report, err := finops.Calculate(canvasRaw, req.ProjectID, req.MonthlyUsers)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(report)
}
