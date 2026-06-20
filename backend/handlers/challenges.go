package handlers

import (
	"database/sql"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"systemdesign/config"
	"systemdesign/models"
	"systemdesign/services"
)

type ChallengeHandler struct {
	DB    *sql.DB
	Redis *redis.Client
}

func NewChallengeHandler(db *sql.DB, rdb *redis.Client) *ChallengeHandler {
	return &ChallengeHandler{DB: db, Redis: rdb}
}

func (h *ChallengeHandler) List(c *fiber.Ctx) error {
	challenges, err := services.ListChallenges(h.DB)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to list challenges"})
	}
	if challenges == nil {
		challenges = make([]models.ChallengeResponse, 0)
	}
	return c.JSON(fiber.Map{"challenges": challenges})
}

func (h *ChallengeHandler) Get(c *fiber.Ctx) error {
	id := c.Params("id")
	challenge, err := services.GetChallengeByID(h.DB, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "challenge not found"})
	}
	return c.JSON(challenge)
}

func (h *ChallengeHandler) Start(c *fiber.Ctx) error {
	id := c.Params("id")

	challenge, err := services.GetChallengeByID(h.DB, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "challenge not found"})
	}

	claims, ok := c.Locals("user").(*config.JWTClaims)
	if !ok || claims.UserID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}

	project, err := services.CreateProjectFromCanvas(h.DB, claims.UserID, challenge.InitialCanvas, id, challenge.Title)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to create project from challenge"})
	}

	resp := models.ChallengeResponse{
		ID:               challenge.ID,
		Title:            challenge.Title,
		Description:      challenge.Description,
		Difficulty:       challenge.Difficulty,
		Requirements:     challenge.Requirements,
		InitialCanvas:    challenge.InitialCanvas,
		TimeLimitSeconds: challenge.TimeLimitSeconds,
		PassingCriteria:  challenge.PassingCriteria,
	}

	return c.JSON(fiber.Map{
		"project":     project,
		"challenge":   resp,
		"timeLimitMs": challenge.TimeLimitSeconds * 1000,
	})
}

func (h *ChallengeHandler) Submit(c *fiber.Ctx) error {
	id := c.Params("id")

	claims, ok := c.Locals("user").(*config.JWTClaims)
	if !ok || claims.UserID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req models.SubmitRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.ProjectID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "projectId is required"})
	}

	var canvasRaw []byte
	err := h.DB.QueryRow(
		`SELECT canvas_data FROM projects WHERE id = $1 AND user_id = $2`,
		req.ProjectID, claims.UserID,
	).Scan(&canvasRaw)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "project not found or access denied"})
	}

	challenge, err := services.GetChallengeByID(h.DB, id)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "challenge not found"})
	}

	score, err := services.ScoreSubmission(canvasRaw, challenge)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	submission, err := services.SaveSubmission(h.DB, claims.UserID, id, req.ProjectID, score)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to save submission"})
	}

	return c.JSON(fiber.Map{
		"submission": submission,
		"score":      score,
	})
}

type drillStartRequest struct {
	ProjectID string `json:"projectId"`
	Scenario  string `json:"scenario"`
}

func (h *ChallengeHandler) StartDrill(c *fiber.Ctx) error {
	claims, ok := c.Locals("user").(*config.JWTClaims)
	if !ok || claims.UserID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req drillStartRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.ProjectID == "" || req.Scenario == "" {
		return c.Status(400).JSON(fiber.Map{"error": "projectId and scenario are required"})
	}

	var canvasRaw []byte
	err := h.DB.QueryRow(
		`SELECT canvas_data FROM projects WHERE id = $1 AND user_id = $2`,
		req.ProjectID, claims.UserID,
	).Scan(&canvasRaw)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "project not found or access denied"})
	}

	result, err := services.RunDrill(canvasRaw, req.ProjectID, req.Scenario)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(result)
}

func (h *ChallengeHandler) Leaderboard(c *fiber.Ctx) error {
	entries, err := services.GetLeaderboard(h.DB, 20)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to load leaderboard"})
	}
	if entries == nil {
		entries = make([]models.LeaderboardEntry, 0)
	}
	return c.JSON(fiber.Map{"leaderboard": entries})
}

func SeedChallengeData(db *sql.DB) error {
	return services.SeedChallenges(db)
}
