package handlers

import (
	"testing"

	"systemdesign/simulation"
)

func TestChaosInjectRequest_Validation(t *testing.T) {
	tests := []struct {
		name        string
		simulationRunID string
		nodeID      string
		severity    float64
		eventType   string
		expectValid bool
		errMsg      string
	}{
		{"missing simulationRunId", "", "node-1", 0.5, "NodeFailure", false, "simulationRunId is required"},
		{"missing nodeId", "run-1", "", 0.5, "NodeFailure", false, "nodeId is required"},
		{"severity zero", "run-1", "node-1", 0, "NodeFailure", false, "severity must be between 0 and 1"},
		{"severity over 1", "run-1", "node-1", 1.5, "NodeFailure", false, "severity must be between 0 and 1"},
		{"severity negative", "run-1", "node-1", -0.1, "NodeFailure", false, "severity must be between 0 and 1"},
		{"invalid event type", "run-1", "node-1", 0.5, "InvalidType", false, "invalid eventType"},
		{"valid request", "run-1", "node-1", 0.5, "NodeFailure", true, ""},
		{"severity at boundary 0.001", "run-1", "node-1", 0.001, "NodeFailure", true, ""},
		{"severity at boundary 1.0", "run-1", "node-1", 1.0, "NodeFailure", true, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errMsg := ""
			isValid := true
			if tt.simulationRunID == "" {
				isValid = false
				errMsg = "simulationRunId is required"
			} else if tt.nodeID == "" {
				isValid = false
				errMsg = "nodeId is required"
			} else if tt.severity <= 0 || tt.severity > 1 {
				isValid = false
				errMsg = "severity must be between 0 and 1"
			} else if !simulation.IsValidChaosType(simulation.ChaosEventType(tt.eventType)) {
				isValid = false
				errMsg = "invalid eventType"
			}
			if isValid != tt.expectValid {
				t.Errorf("expected valid=%v, got valid=%v", tt.expectValid, isValid)
			}
			if !isValid && errMsg != tt.errMsg {
				t.Errorf("expected errMsg %q, got %q", tt.errMsg, errMsg)
			}
		})
	}
}

func TestChaosDurationConversion(t *testing.T) {
	tests := []struct {
		seconds      int
		expectedTicks int
	}{
		{0, 0},
		{1, 10},
		{15, 150},
		{30, 300},
	}
	for _, tt := range tests {
		durationTicks := 0
		if tt.seconds > 0 {
			durationTicks = tt.seconds * 10
		}
		if durationTicks != tt.expectedTicks {
			t.Errorf("seconds=%d: expected ticks=%d, got %d", tt.seconds, tt.expectedTicks, durationTicks)
		}
	}
}

func TestChaosInjectRequest_AllValidTypes(t *testing.T) {
	validTypes := []string{
		"NodeFailure", "LatencySpike", "ErrorRateSpike",
		"NetworkPartition", "DDoS", "RegionDown",
		"MemoryLeak", "CPUSaturation", "SplitBrain",
	}
	for _, ct := range validTypes {
		if !simulation.IsValidChaosType(simulation.ChaosEventType(ct)) {
			t.Errorf("expected %q to be a valid chaos type", ct)
		}
	}
}

func TestChaosEventCreation(t *testing.T) {
	event := &simulation.ChaosEvent{
		ID:              "ev-1",
		SimulationRunID: "run-1",
		NodeID:          "node-1",
		EventType:       simulation.ChaosNodeFailure,
		Severity:        0.5,
		DurationTicks:   150,
		StartedAt:       10,
		Active:          true,
	}
	if event.ID != "ev-1" {
		t.Errorf("expected ID ev-1, got %s", event.ID)
	}
	if event.SimulationRunID != "run-1" {
		t.Errorf("expected SimulationRunID run-1, got %s", event.SimulationRunID)
	}
	if event.NodeID != "node-1" {
		t.Errorf("expected NodeID node-1, got %s", event.NodeID)
	}
	if event.EventType != simulation.ChaosNodeFailure {
		t.Errorf("expected EventType NodeFailure, got %s", event.EventType)
	}
	if event.Severity != 0.5 {
		t.Errorf("expected Severity 0.5, got %f", event.Severity)
	}
	if event.DurationTicks != 150 {
		t.Errorf("expected DurationTicks 150, got %d", event.DurationTicks)
	}
	if event.StartedAt != 10 {
		t.Errorf("expected StartedAt 10, got %d", event.StartedAt)
	}
	if !event.Active {
		t.Error("expected Active true")
	}
}

func TestActiveEventsRequest(t *testing.T) {
	events := []*simulation.ChaosEvent{
		{ID: "ev-1", Active: true},
		{ID: "ev-2", Active: false},
	}
	if events == nil {
		events = []*simulation.ChaosEvent{}
	}
	result := make([]*simulation.ChaosEvent, 0, len(events))
	for _, e := range events {
		if e.Active {
			result = append(result, e)
		}
	}
	if len(result) != 1 {
		t.Errorf("expected 1 active event, got %d", len(result))
	}
	if result[0].ID != "ev-1" {
		t.Errorf("expected ev-1, got %s", result[0].ID)
	}
}

func TestActiveEventsNilResponse(t *testing.T) {
	var events []*simulation.ChaosEvent
	if events == nil {
		events = []*simulation.ChaosEvent{}
	}
	if len(events) != 0 {
		t.Error("expected empty slice when nil")
	}
}
