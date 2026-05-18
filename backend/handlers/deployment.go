package handlers

import (
	"github.com/gofiber/fiber/v2"
)

type DeploymentHandler struct {
	simHandler *SimulationHandler
}

func NewDeploymentHandler(simHandler *SimulationHandler) *DeploymentHandler {
	return &DeploymentHandler{simHandler: simHandler}
}

type shiftRequest struct {
	NodeID        string  `json:"nodeId"`
	CanaryPercent float64 `json:"canaryPercent"`
}

type failoverRequest struct {
	NodeID    string `json:"nodeId"`
	Direction string `json:"direction"` // "stable" | "canary" | "blue" | "green"
}

func (h *DeploymentHandler) Shift(c *fiber.Ctx) error {
	runID := c.Params("id")
	if runID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "simulation run ID required"})
	}

	var req shiftRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.NodeID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "nodeId is required"})
	}
	if req.CanaryPercent < 0 || req.CanaryPercent > 100 {
		return c.Status(400).JSON(fiber.Map{"error": "canaryPercent must be between 0 and 100"})
	}

	engine := h.simHandler.FindEngine(runID)
	if engine == nil {
		return c.Status(404).JSON(fiber.Map{"error": "simulation run not found"})
	}
	if !engine.IsRunning() {
		return c.Status(400).JSON(fiber.Map{"error": "simulation is not running"})
	}

	dm := engine.GetDeploymentManager()
	if dm == nil {
		return c.Status(500).JSON(fiber.Map{"error": "deployment manager not initialized"})
	}

	dm.ShiftCanary(req.NodeID, req.CanaryPercent)

	return c.JSON(fiber.Map{
		"status":        "shifted",
		"nodeId":        req.NodeID,
		"canaryPercent": req.CanaryPercent,
	})
}

type promoteRequest struct {
	NodeID string `json:"nodeId"`
}

type setGroupRequest struct {
	NodeID string `json:"nodeId"`
	Group  string `json:"group"` // "blue" or "green"
}

func (h *DeploymentHandler) Promote(c *fiber.Ctx) error {
	runID := c.Params("id")
	if runID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "simulation run ID required"})
	}

	var req promoteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.NodeID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "nodeId is required"})
	}

	engine := h.simHandler.FindEngine(runID)
	if engine == nil {
		return c.Status(404).JSON(fiber.Map{"error": "simulation run not found"})
	}
	if !engine.IsRunning() {
		return c.Status(400).JSON(fiber.Map{"error": "simulation is not running"})
	}

	dm := engine.GetDeploymentManager()
	if dm == nil {
		return c.Status(500).JSON(fiber.Map{"error": "deployment manager not initialized"})
	}

	dm.PromoteBlueGreen(req.NodeID)

	state := dm.GetState(req.NodeID)
	return c.JSON(fiber.Map{
		"status":      "promoted",
		"nodeId":      req.NodeID,
		"activeGroup": state.ActiveGroup,
	})
}

func (h *DeploymentHandler) GetState(c *fiber.Ctx) error {
	runID := c.Params("id")
	if runID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "simulation run ID required"})
	}

	engine := h.simHandler.FindEngine(runID)
	if engine == nil {
		return c.Status(404).JSON(fiber.Map{"error": "simulation run not found"})
	}

	dm := engine.GetDeploymentManager()
	if dm == nil {
		return c.Status(500).JSON(fiber.Map{"error": "deployment manager not initialized"})
	}

	states := dm.AllStates()
	return c.JSON(fiber.Map{"states": states})
}

func (h *DeploymentHandler) SetGroup(c *fiber.Ctx) error {
	runID := c.Params("id")
	if runID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "simulation run ID required"})
	}

	var req setGroupRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.NodeID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "nodeId is required"})
	}
	if req.Group != "blue" && req.Group != "green" {
		return c.Status(400).JSON(fiber.Map{"error": "group must be 'blue' or 'green'"})
	}

	engine := h.simHandler.FindEngine(runID)
	if engine == nil {
		return c.Status(404).JSON(fiber.Map{"error": "simulation run not found"})
	}
	if !engine.IsRunning() {
		return c.Status(400).JSON(fiber.Map{"error": "simulation is not running"})
	}

	dm := engine.GetDeploymentManager()
	if dm == nil {
		return c.Status(500).JSON(fiber.Map{"error": "deployment manager not initialized"})
	}

	dm.SetGroup(req.NodeID, req.Group)

	return c.JSON(fiber.Map{
		"status": "group_set",
		"nodeId": req.NodeID,
		"group":  req.Group,
	})
}

func (h *DeploymentHandler) Failover(c *fiber.Ctx) error {
	runID := c.Params("id")
	if runID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "simulation run ID required"})
	}

	var req failoverRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.NodeID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "nodeId is required"})
	}
	if req.Direction == "" {
		return c.Status(400).JSON(fiber.Map{"error": "direction is required (stable/canary for canary, blue/green for blue_green)"})
	}

	engine := h.simHandler.FindEngine(runID)
	if engine == nil {
		return c.Status(404).JSON(fiber.Map{"error": "simulation run not found"})
	}
	if !engine.IsRunning() {
		return c.Status(400).JSON(fiber.Map{"error": "simulation is not running"})
	}

	dm := engine.GetDeploymentManager()
	if dm == nil {
		return c.Status(500).JSON(fiber.Map{"error": "deployment manager not initialized"})
	}

	dm.Failover(req.NodeID, req.Direction)

	return c.JSON(fiber.Map{
		"status":    "failover_complete",
		"nodeId":    req.NodeID,
		"direction": req.Direction,
	})
}
