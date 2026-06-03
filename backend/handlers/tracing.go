package handlers

import (
	"github.com/gofiber/fiber/v2"
	"systemdesign/simulation"
)

type LogsQuery struct {
	Service string `query:"service"`
	Level   string `query:"level"`
	TraceID string `query:"traceId"`
	Page    int    `query:"page"`
	PerPage int    `query:"perPage"`
}

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

func (h *SimulationHandler) GetLogs(c *fiber.Ctx) error {
	runID := c.Params("id")
	if runID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "simulation run ID required"})
	}

	var q LogsQuery
	if err := c.QueryParser(&q); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid query parameters"})
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

	if engine.LogCollector == nil {
		return c.JSON(fiber.Map{"logs": []any{}, "total": 0, "page": q.Page, "perPage": q.PerPage})
	}

	allLogs := engine.LogCollector.Filter(q.Service, q.Level, q.TraceID)
	total := len(allLogs)

	if q.Page <= 0 {
		q.Page = 1
	}
	if q.PerPage <= 0 || q.PerPage > 1000 {
		q.PerPage = 100
	}

	start := (q.Page - 1) * q.PerPage
	if start >= total || start < 0 {
		allLogs = []simulation.SimLog{}
	} else {
		end := start + q.PerPage
		if end > total {
			end = total
		}
		allLogs = allLogs[start:end]
	}

	if allLogs == nil {
		allLogs = []simulation.SimLog{}
	}

	return c.JSON(fiber.Map{
		"logs":    allLogs,
		"total":   total,
		"page":    q.Page,
		"perPage": q.PerPage,
	})
}
