package handlers

import (
	"database/sql"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"systemdesign/config"
	"systemdesign/iac"
)

type ExportHandler struct {
	DB    *sql.DB
	Redis *redis.Client
}

func NewExportHandler(db *sql.DB, rdb *redis.Client) *ExportHandler {
	return &ExportHandler{DB: db, Redis: rdb}
}

type exportRequest struct {
	ProjectID string `json:"projectId"`
	Format    string `json:"format"`
}

type exportResponse struct {
	Content  string `json:"content"`
	Filename string `json:"filename"`
}

var formatExtensions = map[string]string{
	"terraform":      "tf",
	"kubernetes":     "yaml",
	"cloudformation": "json",
}

func (h *ExportHandler) Export(c *fiber.Ctx) error {
	var req exportRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.ProjectID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "projectId is required"})
	}
	if req.Format == "" {
		return c.Status(400).JSON(fiber.Map{"error": "format is required"})
	}
	if _, ok := formatExtensions[req.Format]; !ok {
		return c.Status(400).JSON(fiber.Map{"error": "format must be one of: terraform, kubernetes, cloudformation"})
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
	var projectName string
	err = h.DB.QueryRow(
		`SELECT name, canvas_data FROM projects WHERE id = $1`, req.ProjectID,
	).Scan(&projectName, &canvasRaw)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to read project data"})
	}

	data, err := iac.ParseCanvasData(canvasRaw)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to parse canvas data: " + err.Error()})
	}

	data.ProjectID = req.ProjectID
	data.ProjectName = projectName

	var content string
	switch req.Format {
	case "terraform":
		content, err = iac.GenerateTerraform(data)
	case "kubernetes":
		content, err = iac.GenerateKubernetes(data)
	case "cloudformation":
		content, err = iac.GenerateCloudFormation(data)
	}
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "generation failed: " + err.Error()})
	}

	ext := formatExtensions[req.Format]
	filename := projectName + "-infrastructure." + ext

	return c.JSON(exportResponse{
		Content:  content,
		Filename: filename,
	})
}
