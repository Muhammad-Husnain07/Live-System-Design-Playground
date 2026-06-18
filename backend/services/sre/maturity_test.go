package sre

import (
	"testing"

	"systemdesign/services/security"
	"systemdesign/simulation"
)

func TestClassifyLevel(t *testing.T) {
	tests := []struct {
		score float64
		want  CertificationLevel
	}{
		{0, LevelDevelopment},
		{20, LevelDevelopment},
		{40, LevelDevelopment},
		{41, LevelStaging},
		{55, LevelStaging},
		{70, LevelStaging},
		{71, LevelProduction},
		{80, LevelProduction},
		{90, LevelProduction},
		{91, LevelEnterprise},
		{100, LevelEnterprise},
	}
	for _, tc := range tests {
		got := classifyLevel(tc.score)
		if got != tc.want {
			t.Errorf("classifyLevel(%.0f) = %q, want %q", tc.score, got, tc.want)
		}
	}
}

func TestScoreRedundancy_EmptyGraph(t *testing.T) {
	graph := security.InfraGraph{}
	cfg := &simulation.Config{}
	score := scoreRedundancy(graph, cfg)
	if score != 0 {
		t.Errorf("expected 0 for empty graph, got %.0f", score)
	}
}

func TestScoreRedundancy_LoadBalancer(t *testing.T) {
	graph := security.InfraGraph{
		Nodes: []security.Node{
			{ID: "lb", NodeType: "LoadBalancer"},
		},
	}
	cfg := &simulation.Config{}
	score := scoreRedundancy(graph, cfg)
	if score != 5 {
		t.Errorf("expected 5 for LB only, got %.0f", score)
	}
}

func TestScoreRedundancy_FullScore(t *testing.T) {
	graph := security.InfraGraph{
		Nodes: []security.Node{
			{ID: "lb", NodeType: "LoadBalancer"},
			{ID: "web1", NodeType: "WebServer"},
			{ID: "web2", NodeType: "WebServer"},
			{ID: "web3", NodeType: "AppServer"},
			{ID: "db1", NodeType: "PostgreSQLDB"},
			{ID: "db2", NodeType: "MySQLDB"},
			{ID: "cluster", NodeType: "ContainerCluster"},
		},
	}
	cfg := &simulation.Config{
		Nodes: []simulation.Node{
			{Instances: 3, ReplicationRole: "primary"},
			{Instances: 3, ReplicationRole: "replica"},
			{Instances: 3},
		},
	}
	score := scoreRedundancy(graph, cfg)
	if score > 25 {
		t.Errorf("expected max 25, got %.0f", score)
	}
	if score < 20 {
		t.Errorf("expected high redundancy score, got %.0f", score)
	}
}

func TestScoreRedundancy_CappedAt25(t *testing.T) {
	graph := security.InfraGraph{
		Nodes: []security.Node{
			{ID: "lb", NodeType: "LoadBalancer"},
			{ID: "w1", NodeType: "WebServer"},
			{ID: "w2", NodeType: "WebServer"},
			{ID: "w3", NodeType: "WebServer"},
			{ID: "w4", NodeType: "WebServer"},
			{ID: "w5", NodeType: "WebServer"},
			{ID: "w6", NodeType: "WebServer"},
			{ID: "dns", NodeType: "DNS"},
			{ID: "db1", NodeType: "PostgreSQLDB"},
			{ID: "db2", NodeType: "Redis"},
			{ID: "cluster", NodeType: "ContainerCluster"},
		},
	}
	cfg := &simulation.Config{
		Nodes: []simulation.Node{
			{Instances: 5, ReplicationRole: "primary"},
			{Instances: 3, ReplicationRole: "replica"},
		},
	}
	score := scoreRedundancy(graph, cfg)
	if score != 25 {
		t.Errorf("expected cap at 25, got %.0f", score)
	}
}

func TestScoreRedundancy_NilConfig(t *testing.T) {
	graph := security.InfraGraph{
		Nodes: []security.Node{
			{ID: "lb", NodeType: "LoadBalancer"},
			{ID: "w1", NodeType: "WebServer"},
			{ID: "w2", NodeType: "WebServer"},
		},
	}
	score := scoreRedundancy(graph, nil)
	if score <= 0 {
		t.Errorf("expected non-zero score without sim config, got %.0f", score)
	}
}

func TestScoreObservability_NilConfig(t *testing.T) {
	score := scoreObservability(nil)
	if score != 5 {
		t.Errorf("expected 5 when cfg is nil, got %.0f", score)
	}
}

func TestScoreObservability_NoSLOs(t *testing.T) {
	cfg := &simulation.Config{
		Nodes: []simulation.Node{
			{ID: "web", SLOTargetMs: 0, SLOAvailabilityTarget: 0},
		},
	}
	score := scoreObservability(cfg)
	if score != 10 {
		t.Errorf("expected 10 with cfg but no SLOs, got %.0f", score)
	}
}

func TestScoreObservability_WithOneSLO(t *testing.T) {
	cfg := &simulation.Config{
		Nodes: []simulation.Node{
			{ID: "web", SLOTargetMs: 500},
		},
	}
	score := scoreObservability(cfg)
	if score != 22 {
		t.Errorf("expected 22 with one SLO node, got %.0f", score)
	}
}

func TestScoreObservability_MaxScore(t *testing.T) {
	cfg := &simulation.Config{
		Nodes: []simulation.Node{
			{ID: "w1", SLOTargetMs: 100, SLOAvailabilityTarget: 0.999},
			{ID: "w2", SLOTargetMs: 200, SLOAvailabilityTarget: 0.99},
			{ID: "w3", SLOTargetMs: 300, SLOAvailabilityTarget: 0.9999},
		},
	}
	score := scoreObservability(cfg)
	if score != 25 {
		t.Errorf("expected 25 with 3+ SLO nodes, got %.0f", score)
	}
}

func TestScoreObservability_CappedAt25(t *testing.T) {
	cfg := &simulation.Config{
		Nodes: []simulation.Node{
			{ID: "w1", SLOTargetMs: 100},
			{ID: "w2", SLOTargetMs: 200},
			{ID: "w3", SLOTargetMs: 300},
			{ID: "w4", SLOTargetMs: 400},
		},
	}
	score := scoreObservability(cfg)
	if score > 25 {
		t.Errorf("expected cap at 25, got %.0f", score)
	}
}

func TestScoreSecurity_NoViolations(t *testing.T) {
	score := scoreSecurity(nil)
	if score != 25 {
		t.Errorf("expected 25 with no violations, got %.0f", score)
	}
}

func TestScoreSecurity_CriticalViolations(t *testing.T) {
	violations := []security.SecurityViolation{
		{Severity: security.SeverityCritical},
		{Severity: security.SeverityCritical},
	}
	score := scoreSecurity(violations)
	if score != 15 {
		t.Errorf("expected 15 (25-5-5), got %.0f", score)
	}
}

func TestScoreSecurity_MixedViolations(t *testing.T) {
	violations := []security.SecurityViolation{
		{Severity: security.SeverityCritical},
		{Severity: security.SeverityWarning},
		{Severity: security.SeverityWarning},
	}
	score := scoreSecurity(violations)
	if score != 16 {
		t.Errorf("expected 16 (25-5-2-2), got %.0f", score)
	}
}

func TestScoreSecurity_FloorAtZero(t *testing.T) {
	violations := make([]security.SecurityViolation, 10)
	for i := range violations {
		violations[i] = security.SecurityViolation{Severity: security.SeverityCritical}
	}
	score := scoreSecurity(violations)
	if score != 0 {
		t.Errorf("expected floor at 0, got %.0f", score)
	}
}

func TestScoreResilience_Empty(t *testing.T) {
	graph := security.InfraGraph{}
	cfg := &simulation.Config{}
	score := scoreResilience(graph, cfg)
	if score != 5 {
		t.Errorf("expected 5 (base for cfg present), got %.0f", score)
	}
}

func TestScoreResilience_NilConfig(t *testing.T) {
	graph := security.InfraGraph{}
	score := scoreResilience(graph, nil)
	if score != 0 {
		t.Errorf("expected 0 with nil config, got %.0f", score)
	}
}

func TestScoreResilience_FullScore(t *testing.T) {
	graph := security.InfraGraph{
		Nodes: []security.Node{
			{ID: "cluster", NodeType: "ContainerCluster"},
			{ID: "dns", NodeType: "DNS"},
		},
	}
	cfg := &simulation.Config{
		Nodes: []simulation.Node{
			{Region: "eu-west-1", Deployment: simulation.DeploymentConfig{Strategy: simulation.StrategyCanary}, AutoScaling: simulation.AutoScaling{Enabled: true}},
		},
	}
	score := scoreResilience(graph, cfg)
	if score != 25 {
		t.Errorf("expected 25 (5+5+5+3+5+2), got %.0f", score)
	}
}

func TestScoreResilience_CappedAt25(t *testing.T) {
	graph := security.InfraGraph{
		Nodes: []security.Node{
			{ID: "cluster", NodeType: "ContainerCluster"},
			{ID: "dns1", NodeType: "DNS"},
			{ID: "dns2", NodeType: "DNS"},
		},
	}
	cfg := &simulation.Config{
		Nodes: []simulation.Node{
			{Region: "eu-west-1", Deployment: simulation.DeploymentConfig{Strategy: simulation.StrategyCanary}, AutoScaling: simulation.AutoScaling{Enabled: true}},
		},
	}
	score := scoreResilience(graph, cfg)
	if score > 25 {
		t.Errorf("expected max 25, got %.0f", score)
	}
}

func TestCalculateMaturity_EmptyGraph(t *testing.T) {
	report := CalculateMaturity(security.InfraGraph{}, nil, nil)
	if report.Score != 5+0+25+0 {
		t.Errorf("expected score 30 (5 obs + 0 red + 25 sec + 0 res), got %.0f", report.Score)
	}
	if report.Level != LevelDevelopment {
		t.Errorf("expected Development level, got %q", report.Level)
	}
}

func TestCalculateMaturity_EnterpriseLevel(t *testing.T) {
	graph := security.InfraGraph{
		Nodes: []security.Node{
			{ID: "lb", NodeType: "LoadBalancer"},
			{ID: "w1", NodeType: "WebServer"},
			{ID: "w2", NodeType: "WebServer"},
			{ID: "w3", NodeType: "WebServer"},
			{ID: "w4", NodeType: "WebServer"},
			{ID: "db1", NodeType: "PostgreSQLDB"},
			{ID: "db2", NodeType: "MongoDB"},
			{ID: "cluster", NodeType: "ContainerCluster"},
			{ID: "dns", NodeType: "DNS"},
		},
	}
	cfg := &simulation.Config{
		Nodes: []simulation.Node{
			{ID: "w1", Instances: 3, SLOTargetMs: 100, SLOAvailabilityTarget: 0.999, Region: "eu-west-1",
				Deployment: simulation.DeploymentConfig{Strategy: simulation.StrategyCanary},
				AutoScaling: simulation.AutoScaling{Enabled: true},
				ReplicationRole: "primary"},
			{ID: "w2", Instances: 3, SLOTargetMs: 200, SLOAvailabilityTarget: 0.99, Region: "ap-southeast-1",
				Deployment: simulation.DeploymentConfig{Strategy: simulation.StrategyBlueGreen},
				AutoScaling: simulation.AutoScaling{Enabled: true}},
			{ID: "w3", Instances: 3, SLOTargetMs: 300, SLOAvailabilityTarget: 0.9999,
				AutoScaling: simulation.AutoScaling{Enabled: true}},
			{ID: "db1", Instances: 2, ReplicationRole: "replica"},
		},
	}
	engine := simulation.NewEngine(cfg)
	report := CalculateMaturity(graph, engine, nil)
	if report.Score < 91 {
		t.Errorf("expected Enterprise (>=91), got %.0f (%s)", report.Score, report.Level)
	}
	if report.Level != LevelEnterprise {
		t.Errorf("expected Enterprise Grade, got %q", report.Level)
	}
}

func TestCalculateMaturity_WithViolations(t *testing.T) {
	graph := security.InfraGraph{
		Nodes: []security.Node{
			{ID: "w1", NodeType: "WebServer", Security: security.SecurityConfig{IsPublicFacing: true}},
		},
	}
	violations := []security.SecurityViolation{
		{Severity: security.SeverityCritical, Message: "Public endpoint", Remediation: "Restrict access"},
	}
	report := CalculateMaturity(graph, nil, violations)
	if report.Breakdown.Security != 20 {
		t.Errorf("expected security 20 (25-5), got %.0f", report.Breakdown.Security)
	}
	if len(report.Recommendations) == 0 {
		t.Error("expected recommendations when violations present")
	}
}

func TestCalculateMaturity_RecommendationsGenerated(t *testing.T) {
	graph := security.InfraGraph{}
	report := CalculateMaturity(graph, nil, nil)
	if len(report.Recommendations) == 0 {
		t.Error("expected recommendations for empty graph")
	}
}

func TestCalculateMaturity_WellArchitectedNoRecs(t *testing.T) {
	graph := security.InfraGraph{
		Nodes: []security.Node{
			{ID: "lb", NodeType: "LoadBalancer"},
			{ID: "w1", NodeType: "WebServer"},
			{ID: "w2", NodeType: "WebServer"},
			{ID: "w3", NodeType: "WebServer"},
			{ID: "db1", NodeType: "PostgreSQLDB"},
			{ID: "db2", NodeType: "MongoDB"},
			{ID: "cluster", NodeType: "ContainerCluster"},
			{ID: "dns", NodeType: "DNS"},
		},
	}
	cfg := &simulation.Config{
		Nodes: []simulation.Node{
			{ID: "w1", Instances: 3, SLOTargetMs: 100, SLOAvailabilityTarget: 0.999, Region: "eu-west-1",
				Deployment: simulation.DeploymentConfig{Strategy: simulation.StrategyCanary},
				AutoScaling: simulation.AutoScaling{Enabled: true}},
			{ID: "w2", Instances: 3, SLOTargetMs: 200, SLOAvailabilityTarget: 0.99, Region: "ap-southeast-1",
				Deployment: simulation.DeploymentConfig{Strategy: simulation.StrategyBlueGreen},
				AutoScaling: simulation.AutoScaling{Enabled: true}},
			{ID: "w3", Instances: 3, SLOTargetMs: 300, SLOAvailabilityTarget: 0.9999,
				AutoScaling: simulation.AutoScaling{Enabled: true}},
		},
	}
	engine := simulation.NewEngine(cfg)
	report := CalculateMaturity(graph, engine, nil)
	hasGeneral := false
	for _, r := range report.Recommendations {
		if r.Category == "general" {
			hasGeneral = true
			break
		}
	}
	if !hasGeneral {
		t.Error("expected a general well-architected recommendation for high scores")
	}
}
