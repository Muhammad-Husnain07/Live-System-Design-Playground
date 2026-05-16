package handlers

import (
	"context"
	"database/sql"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"systemdesign/config"
	"systemdesign/services"
)

type AuthHandler struct {
	DB           *sql.DB
	Redis        *redis.Client
	JWTSecret    string
	FrontendURL  string
}

func NewAuthHandler(cfg *config.Config, db *sql.DB, rdb *redis.Client) *AuthHandler {
	return &AuthHandler{
		DB:          db,
		Redis:       rdb,
		JWTSecret:   cfg.JWTSecret,
		FrontendURL: cfg.FrontendURL,
	}
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req struct {
		Email    string `json:"email"`
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	user, err := services.RegisterUser(h.DB, req.Email, req.Username, req.Password)
	if err != nil {
		code := fiber.StatusBadRequest
		return c.Status(code).JSON(fiber.Map{"error": err.Error()})
	}

	token, err := config.GenerateToken(user.ID, user.Email, user.Username, h.JWTSecret)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to generate token",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"user":  user,
		"token": token,
	})
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	user, err := services.AuthenticateUser(h.DB, req.Email, req.Password)
	if err != nil {
		if err == services.ErrInvalidCreds {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "login failed"})
	}

	token, err := config.GenerateToken(user.ID, user.Email, user.Username, h.JWTSecret)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to generate token",
		})
	}

	return c.JSON(fiber.Map{
		"user":  user,
		"token": token,
	})
}

func (h *AuthHandler) Me(c *fiber.Ctx) error {
	claims := c.Locals("user").(*config.JWTClaims)

	user, err := services.GetUserByID(h.DB, claims.UserID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "user not found",
		})
	}

	return c.JSON(fiber.Map{"user": user})
}

func (h *AuthHandler) WsTicket(c *fiber.Ctx) error {
	claims := c.Locals("user").(*config.JWTClaims)

	ticket := uuid.New().String()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := h.Redis.Set(ctx, "ws_ticket:"+ticket, claims.UserID, 60*time.Second).Err()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create ticket",
		})
	}

	return c.JSON(fiber.Map{"ticket": ticket})
}
