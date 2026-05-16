package handlers

import (
	"database/sql"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"systemdesign/config"
	"systemdesign/services"
)

type UserHandler struct {
	DB    *sql.DB
	Redis *redis.Client
}

func NewUserHandler(cfg *config.Config, db *sql.DB, rdb *redis.Client) *UserHandler {
	return &UserHandler{DB: db, Redis: rdb}
}

func (h *UserHandler) GetProfile(c *fiber.Ctx) error {
	claims := c.Locals("user").(*config.JWTClaims)

	profile, err := services.GetFullProfile(h.DB, claims.UserID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"user": profile})
}

func (h *UserHandler) UpdateProfile(c *fiber.Ctx) error {
	claims := c.Locals("user").(*config.JWTClaims)

	var req struct {
		Email    *string `json:"email"`
		Username *string `json:"username"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	profile, err := services.UpdateProfile(h.DB, claims.UserID, req.Email, req.Username)
	if err != nil {
		code := fiber.StatusBadRequest
		return c.Status(code).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"user": profile})
}

func (h *UserHandler) ChangePassword(c *fiber.Ctx) error {
	claims := c.Locals("user").(*config.JWTClaims)

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	err := services.ChangePassword(h.DB, claims.UserID, req.CurrentPassword, req.NewPassword)
	if err != nil {
		code := fiber.StatusBadRequest
		if err == services.ErrWrongPassword || err == services.ErrUserNotFound {
			code = fiber.StatusBadRequest
		}
		return c.Status(code).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "password updated successfully"})
}

func (h *UserHandler) DeleteAccount(c *fiber.Ctx) error {
	claims := c.Locals("user").(*config.JWTClaims)

	if err := services.DeleteAccount(h.DB, claims.UserID); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "account deleted successfully"})
}
