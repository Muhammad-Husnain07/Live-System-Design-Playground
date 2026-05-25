package handlers

import (
	"github.com/gofiber/fiber/v2"
)

func (h *SimulationHandler) GetTraces(c *fiber.Ctx) error {
	runID := c.Params("id")
	if runID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "simulation run ID required"})
	}

	h.mu.Lock()
	engine, ok := h.engines[runID]
	h.mu.Unlock()

	if !ok {
		engine = h.findEngineFromDB(runID)
		if engine == nil {
			return c.Status(404).JSON(fiber.Map{"error": "simulation run not found"})
		}
	}

	if engine.TraceCollector == nil {
		return c.JSON(fiber.Map{"traces": []any{}})
	}

	traces := engine.TraceCollector.Recent()
	return c.JSON(fiber.Map{"traces": traces})
}
