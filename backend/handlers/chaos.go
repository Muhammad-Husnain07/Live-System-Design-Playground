package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"systemdesign/simulation"
)

type ChaosHandler struct {
	simHandler *SimulationHandler
}

func NewChaosHandler(simHandler *SimulationHandler) *ChaosHandler {
	return &ChaosHandler{simHandler: simHandler}
}

type injectRequest struct {
	SimulationRunID string  `json:"simulationRunId"`
	NodeID          string  `json:"nodeId"`
	EventType       string  `json:"eventType"`
	Severity        float64 `json:"severity"`
	DurationSeconds int     `json:"durationSeconds"`
}

func (h *ChaosHandler) Inject(c *fiber.Ctx) error {
	var req injectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.SimulationRunID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "simulationRunId is required"})
	}
	if req.NodeID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "nodeId is required"})
	}
	if req.Severity <= 0 || req.Severity > 1 {
		return c.Status(400).JSON(fiber.Map{"error": "severity must be between 0 and 1"})
	}

	eventType := simulation.ChaosEventType(req.EventType)
	if !simulation.IsValidChaosType(eventType) {
		return c.Status(400).JSON(fiber.Map{"error": "invalid eventType"})
	}

	engine := h.simHandler.FindEngine(req.SimulationRunID)
	if engine == nil {
		return c.Status(404).JSON(fiber.Map{"error": "simulation run not found"})
	}
	if !engine.IsRunning() {
		return c.Status(400).JSON(fiber.Map{"error": "simulation is not running"})
	}

	durationTicks := 0
	if req.DurationSeconds > 0 {
		durationTicks = req.DurationSeconds * 10
	}

	event := &simulation.ChaosEvent{
		ID:              uuid.New().String(),
		SimulationRunID: req.SimulationRunID,
		NodeID:          req.NodeID,
		EventType:       eventType,
		Severity:        req.Severity,
		DurationTicks:   durationTicks,
		StartedAt:       engine.CurrentTick(),
		Active:          true,
	}

	h.simHandler.Chaos.Inject(event)

	return c.Status(201).JSON(fiber.Map{"event": event})
}

func (h *ChaosHandler) Active(c *fiber.Ctx) error {
	runID := c.Params("simulationRunId")
	if runID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "simulationRunId is required"})
	}
	events := h.simHandler.Chaos.ActiveEvents(runID)
	if events == nil {
		events = []*simulation.ChaosEvent{}
	}
	return c.JSON(fiber.Map{"events": events})
}
