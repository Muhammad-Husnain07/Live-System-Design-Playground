package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"systemdesign/config"
	"systemdesign/iac"
	"systemdesign/models"
	"systemdesign/services"
)

type ImportHandler struct {
	DB    *sql.DB
	Redis *redis.Client
	Cfg   *config.Config
}

func NewImportHandler(db *sql.DB, rdb *redis.Client, cfg *config.Config) *ImportHandler {
	return &ImportHandler{DB: db, Redis: rdb, Cfg: cfg}
}

func (h *ImportHandler) Import(c *fiber.Ctx) error {
	claims := c.Locals("user").(*config.JWTClaims)

	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "file field is required"})
	}

	format := c.FormValue("format")
	if format == "" {
		return c.Status(400).JSON(fiber.Map{"error": "format field is required"})
	}

	f, err := file.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to read uploaded file"})
	}
	defer f.Close()

	raw, err := io.ReadAll(f)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to read file content"})
	}
	content := string(raw)

	var graph *iac.InfraGraph
	switch format {
	case "terraform":
		graph, err = iac.ParseTerraform(content)
	case "kubernetes":
		graph, err = iac.ParseKubernetes(content)
	case "cloudformation":
		graph, err = iac.ParseCloudFormation(content)
	default:
		return c.Status(400).JSON(fiber.Map{"error": "format must be one of: terraform, kubernetes, cloudformation"})
	}
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "failed to parse: " + err.Error()})
	}

	if len(graph.Nodes) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "no supported resources found in the file"})
	}

	cd := iac.ToCanvasData(graph)

	canvasJSON, err := json.Marshal(cd)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to serialize canvas data"})
	}

	projectName := deriveProjectName(file.Filename, format)
	description := fmt.Sprintf("Imported from %s — %d resources, %d edges",
		title(format), len(graph.Nodes), len(graph.Edges))
	desc := &description
	public := false

	project, err := services.CreateProject(h.DB, claims.UserID, projectName, desc, &public)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create project: " + err.Error()})
	}

	_, err = h.DB.Exec(
		`UPDATE projects SET canvas_data = $1::jsonb WHERE id = $2`,
		string(canvasJSON), project.ID,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to save canvas data"})
	}

	projectWithCanvas := models.ProjectDetailResponse{
		ProjectResponse: *project,
		CanvasData:      map[string]any{"nodes": cd.Nodes, "edges": cd.Edges},
		Role:            "owner",
	}

	return c.Status(201).JSON(fiber.Map{"project": projectWithCanvas})
}

func title(s string) string {
	if s == "" {
		return ""
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func deriveProjectName(filename, format string) string {
	name := strings.TrimSuffix(filename, ".tf")
	name = strings.TrimSuffix(name, ".yaml")
	name = strings.TrimSuffix(name, ".yml")
	name = strings.TrimSuffix(name, ".json")
	name = strings.TrimSuffix(name, ".txt")

	if name == filename || name == "" {
		return title(format) + " Import"
	}
	return name
}
