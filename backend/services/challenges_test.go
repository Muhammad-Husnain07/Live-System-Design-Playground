package services

import (
	"encoding/json"
	"math"
	"testing"

	"systemdesign/models"
	"systemdesign/simulation"
)

func TestCalculateCostScore(t *testing.T) {
	tests := []struct {
		name      string
		instances []int
		want      float64
	}{
		{"no nodes", []int{}, 100},
		{"3 instances", []int{1, 1, 1}, 100},
		{"6 instances", []int{3, 3}, 80},
		{"10 instances", []int{5, 5}, 60},
		{"15 instances", []int{8, 7}, 40},
		{"20 instances", []int{10, 10}, 40},
		{"50 instances", []int{25, 25}, 0},
	}
	for _, tc := range tests {
		nodes := make([]simulation.Node, len(tc.instances))
		for i, n := range tc.instances {
			nodes[i] = simulation.Node{ID: string(rune('a' + i)), Instances: n}
		}
		got := calculateCostScore(nodes)
		if math.Abs(got-tc.want) > 0.01 {
			t.Errorf("%s: calculateCostScore = %v, want %v", tc.name, got, tc.want)
		}
	}
}

func TestCalculateReliabilityScore(t *testing.T) {
	tests := []struct {
		name      string
		errorRate float64
		want      float64
	}{
		{"zero error", 0, 100},
		{"1% error", 0.01, 100},
		{"3% error", 0.03, 85},
		{"5% error", 0.05, 60},
		{"10% error", 0.10, 40},
		{"25% error", 0.25, 50},
		{"50% error", 0.50, 0},
	}
	for _, tc := range tests {
		tick := &simulation.Tick{GlobalErrorRate: tc.errorRate}
		got := calculateReliabilityScore(tick)
		if math.Abs(got-tc.want) > 0.01 {
			t.Errorf("%s: calculateReliabilityScore = %v, want %v", tc.name, got, tc.want)
		}
	}
	gotNil := calculateReliabilityScore(nil)
	if gotNil != 0 {
		t.Errorf("nil tick: got %v, want 0", gotNil)
	}
}

func TestCalculatePerformanceScore(t *testing.T) {
	tests := []struct {
		name       string
		achievedRPS float64
		targetRPS  float64
		want       float64
	}{
		{"meets target", 5000, 5000, 100},
		{"exceeds target", 6000, 5000, 100},
		{"50% of target", 2500, 5000, 50},
		{"zero target", 0, 0, 50},
	}
	for _, tc := range tests {
		tick := &simulation.Tick{TotalRPS: tc.achievedRPS}
		got := calculatePerformanceScore(tick, tc.targetRPS)
		if math.Abs(got-tc.want) > 0.01 {
			t.Errorf("%s: calculatePerformanceScore = %v, want %v", tc.name, got, tc.want)
		}
	}
	gotNil := calculatePerformanceScore(nil, 5000)
	if gotNil != 50 {
		t.Errorf("nil tick: got %v, want 50", gotNil)
	}
}

func TestCalculatePerformanceScoreWithBottlenecks(t *testing.T) {
	tick := &simulation.Tick{
		TotalRPS: 6000,
		NodeMetrics: []simulation.NodeMetricsSnapshot{
			{NodeID: "n1", IsBottleneck: true},
			{NodeID: "n2", IsBottleneck: false},
		},
	}
	got := calculatePerformanceScore(tick, 5000)
	if got != 90 {
		t.Errorf("with 1 bottleneck: got %v, want 90", got)
	}
}

func TestRandRange(t *testing.T) {
	for i := 0; i < 100; i++ {
		got := randRange(5, 15)
		if got < 5 || got >= 15 {
			t.Errorf("randRange(5,15) = %d, want in [5,15)", got)
		}
	}
	got := randRange(10, 10)
	if got != 10 {
		t.Errorf("randRange(10,10) = %d, want 10", got)
	}
	got = randRange(10, 5)
	if got != 10 {
		t.Errorf("randRange(10,5) = %d, want 10", got)
	}
}

func TestScenariosExist(t *testing.T) {
	if _, ok := drillScenarios[DrillScenarioRegionDown]; !ok {
		t.Error("missing drill scenario: region_down")
	}
	if _, ok := drillScenarios[DrillScenarioDDoS]; !ok {
		t.Error("missing drill scenario: ddos")
	}
	if _, ok := drillScenarios[DrillScenarioDBFailure]; !ok {
		t.Error("missing drill scenario: db_failure")
	}
}

func TestDrillScenarioConfigs(t *testing.T) {
	for name, sc := range drillScenarios {
		if sc.DurationTicks <= 0 {
			t.Errorf("scenario %q: DurationTicks = %d, want > 0", name, sc.DurationTicks)
		}
		if sc.MonitorDuration <= 0 {
			t.Errorf("scenario %q: MonitorDuration = %d, want > 0", name, sc.MonitorDuration)
		}
		if sc.Severity <= 0 {
			t.Errorf("scenario %q: Severity = %v, want > 0", name, sc.Severity)
		}
	}
}

func TestScoreReportJSON(t *testing.T) {
	report := &ScoreReport{Cost: 80, Reliability: 90, Performance: 85, Total: 85, Passed: true}
	data, err := json.Marshal(report)
	if err != nil {
		t.Fatal(err)
	}
	var decoded ScoreReport
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	if !decoded.Passed {
		t.Error("Passed should be true")
	}
	if decoded.Total != 85 {
		t.Errorf("Total = %v, want 85", decoded.Total)
	}
}

func TestChallengeResponseJSON(t *testing.T) {
	resp := models.ChallengeResponse{
		ID: "ch-1", Title: "Test Challenge", Description: "A test",
		Difficulty: "easy", TimeLimitSeconds: 600,
		Requirements:    json.RawMessage(`{"key":"val"}`),
		InitialCanvas:   json.RawMessage(`{"nodes":[]}`),
		PassingCriteria: json.RawMessage(`{"minScore":50}`),
	}
	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatal(err)
	}
	var decoded models.ChallengeResponse
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.Title != "Test Challenge" {
		t.Errorf("Title = %q, want Test Challenge", decoded.Title)
	}
}
