package handlers

import (
	"database/sql"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"systemdesign/config"
	"systemdesign/models"
	"systemdesign/services"
)

type ProjectHandler struct {
	DB    *sql.DB
	Redis *redis.Client
}

func NewProjectHandler(cfg *config.Config, db *sql.DB, rdb *redis.Client) *ProjectHandler {
	return &ProjectHandler{DB: db, Redis: rdb}
}

func (h *ProjectHandler) List(c *fiber.Ctx) error {
	claims := c.Locals("user").(*config.JWTClaims)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	result, err := services.ListUserProjects(h.DB, claims.UserID, page, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list projects"})
	}

	return c.JSON(result)
}

func (h *ProjectHandler) Get(c *fiber.Ctx) error {
	claims := c.Locals("user").(*config.JWTClaims)
	projectID := c.Params("id")

	project, err := services.GetProjectByID(h.DB, claims.UserID, projectID)
	if err != nil {
		if err == services.ErrProjectNotFound || err == services.ErrForbidden {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to get project"})
	}

	return c.JSON(fiber.Map{"project": project})
}

func (h *ProjectHandler) Create(c *fiber.Ctx) error {
	claims := c.Locals("user").(*config.JWTClaims)

	var req models.CreateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	project, err := services.CreateProject(h.DB, claims.UserID, req.Name, req.Description, req.IsPublic)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"project": project})
}

func (h *ProjectHandler) Update(c *fiber.Ctx) error {
	claims := c.Locals("user").(*config.JWTClaims)
	projectID := c.Params("id")

	var req models.UpdateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	project, err := services.UpdateProject(h.DB, claims.UserID, projectID, req)
	if err != nil {
		code := fiber.StatusBadRequest
		if err == services.ErrForbidden {
			code = fiber.StatusForbidden
		} else if err == services.ErrProjectNotFound {
			code = fiber.StatusNotFound
		}
		return c.Status(code).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"project": project})
}

func (h *ProjectHandler) SaveCanvas(c *fiber.Ctx) error {
	claims := c.Locals("user").(*config.JWTClaims)
	projectID := c.Params("id")

	var req models.SaveCanvasRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	updatedAt, err := services.SaveCanvas(h.DB, claims.UserID, projectID, req.CanvasData)
	if err != nil {
		code := fiber.StatusBadRequest
		if err == services.ErrForbidden {
			code = fiber.StatusForbidden
		} else if err == services.ErrProjectNotFound {
			code = fiber.StatusNotFound
		}
		return c.Status(code).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"saved": true, "updated_at": updatedAt})
}

func (h *ProjectHandler) Delete(c *fiber.Ctx) error {
	claims := c.Locals("user").(*config.JWTClaims)
	projectID := c.Params("id")

	err := services.DeleteProject(h.DB, claims.UserID, projectID)
	if err != nil {
		code := fiber.StatusBadRequest
		if err == services.ErrForbidden {
			code = fiber.StatusForbidden
		} else if err == services.ErrProjectNotFound {
			code = fiber.StatusNotFound
		}
		return c.Status(code).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "project deleted successfully"})
}

func (h *ProjectHandler) AddCollaborator(c *fiber.Ctx) error {
	claims := c.Locals("user").(*config.JWTClaims)
	projectID := c.Params("id")

	var req models.AddCollaboratorRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.Role == "" {
		req.Role = "viewer"
	}

	collab, err := services.AddCollaborator(h.DB, claims.UserID, projectID, req.Email, req.Role)
	if err != nil {
		code := fiber.StatusBadRequest
		if err == services.ErrForbidden {
			code = fiber.StatusForbidden
		} else if err == services.ErrProjectNotFound || err == services.ErrUserNotFound {
			code = fiber.StatusNotFound
		}
		return c.Status(code).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"collaborator": collab})
}

func (h *ProjectHandler) ListCollaborators(c *fiber.Ctx) error {
	claims := c.Locals("user").(*config.JWTClaims)
	projectID := c.Params("id")

	collaborators, err := services.ListCollaborators(h.DB, claims.UserID, projectID)
	if err != nil {
		code := fiber.StatusBadRequest
		if err == services.ErrForbidden {
			code = fiber.StatusForbidden
		} else if err == services.ErrProjectNotFound {
			code = fiber.StatusNotFound
		}
		return c.Status(code).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"collaborators": collaborators})
}
