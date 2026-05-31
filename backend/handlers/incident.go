package handlers

import (
	"github.com/gofiber/fiber/v2"
	"systemdesign/simulation"
)

type IncidentHandler struct {
	simHandler *SimulationHandler
}

func NewIncidentHandler(simHandler *SimulationHandler) *IncidentHandler {
	return &IncidentHandler{simHandler: simHandler}
}

type startIncidentRequest struct {
	ScenarioID string `json:"scenarioId"`
}

func (h *IncidentHandler) StartIncident(c *fiber.Ctx) error {
	runID := c.Params("id")
	if runID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "simulation run ID required"})
	}

	var req startIncidentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.ScenarioID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "scenarioId is required"})
	}

	var scenario *simulation.IncidentScenario
	for i, s := range simulation.Scenarios {
		if s.ID == req.ScenarioID {
			scenario = &simulation.Scenarios[i]
			break
		}
	}
	if scenario == nil {
		return c.Status(404).JSON(fiber.Map{"error": "scenario not found"})
	}

	engine := h.simHandler.FindEngine(runID)
	if engine == nil {
		return c.Status(404).JSON(fiber.Map{"error": "simulation run not found"})
	}
	if !engine.IsRunning() {
		return c.Status(400).JSON(fiber.Map{"error": "simulation is not running"})
	}

	engine.StartIncident(scenario)

	return c.JSON(fiber.Map{
		"status":     "incident_started",
		"scenarioId": scenario.ID,
		"scenario":   scenario.Name,
		"steps":      len(scenario.Steps),
	})
}
