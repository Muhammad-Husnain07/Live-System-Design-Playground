package handlers

import (
	"database/sql"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"systemdesign/services/security"
	"systemdesign/services/sre"
	"systemdesign/simulation"
)

type SREHandler struct {
	DB         *sql.DB
	Redis      *redis.Client
	SimHandler *SimulationHandler
}

type MaturityAuditRequest struct {
	ProjectID       string `json:"projectId"`
	SimulationRunID string `json:"simulationRunId"`
}

func (h *SREHandler) MaturityAudit(c *fiber.Ctx) error {
	var req MaturityAuditRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.ProjectID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "projectId required"})
	}

	// Load project canvas from DB
	var canvasRaw []byte
	if err := h.DB.QueryRow(`SELECT canvas_data FROM projects WHERE id = $1`, req.ProjectID).Scan(&canvasRaw); err != nil {
		if err == sql.ErrNoRows {
			return c.Status(404).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "failed to load project canvas"})
	}

	graph, err := security.ParseCanvasData(canvasRaw)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "failed to parse canvas data: " + err.Error()})
	}

	// Run security audit
	auditor := security.NewSecurityAuditor(graph)
	violations := auditor.Audit()

	// Try to load simulation engine if runID provided
	var engine *simulation.Engine
	if req.SimulationRunID != "" && h.SimHandler != nil {
		h.SimHandler.mu.Lock()
		e, exists := h.SimHandler.engines[req.SimulationRunID]
		h.SimHandler.mu.Unlock()
		if exists {
			engine = e
		}
	}

	report := sre.CalculateMaturity(graph, engine, violations)
	return c.JSON(report)
}
