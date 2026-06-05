package sre

import (
	"fmt"

	"systemdesign/services/security"
	"systemdesign/simulation"
)

type CertificationLevel string

const (
	LevelDevelopment CertificationLevel = "Development"
	LevelStaging     CertificationLevel = "Staging"
	LevelProduction  CertificationLevel = "Production Ready"
	LevelEnterprise  CertificationLevel = "Enterprise Grade"
)

type MaturityBreakdown struct {
	Redundancy    float64 `json:"redundancy"`
	Observability float64 `json:"observability"`
	Security      float64 `json:"security"`
	Resilience    float64 `json:"resilience"`
}

type Recommendation struct {
	Category string `json:"category"`
	Message  string `json:"message"`
	Priority string `json:"priority"`
}

type MaturityReport struct {
	Score           float64            `json:"score"`
	Level           CertificationLevel `json:"level"`
	Breakdown       MaturityBreakdown  `json:"breakdown"`
	Recommendations []Recommendation   `json:"recommendations"`
}

func classifyLevel(score float64) CertificationLevel {
	switch {
	case score >= 91:
		return LevelEnterprise
	case score >= 71:
		return LevelProduction
	case score >= 41:
		return LevelStaging
	default:
		return LevelDevelopment
	}
}

func CalculateMaturity(graph security.InfraGraph, engine *simulation.Engine, violations []security.SecurityViolation) MaturityReport {
	var cfg *simulation.Config
	if engine != nil {
		cfg = engine.Config()
	}

	redScore := scoreRedundancy(graph, cfg)
	obsScore := scoreObservability(cfg)
	secScore := scoreSecurity(violations)
	resScore := scoreResilience(graph, cfg)

	total := redScore + obsScore + secScore + resScore
	level := classifyLevel(total)
	recs := generateRecommendations(graph, cfg, violations, redScore, obsScore, secScore, resScore)

	return MaturityReport{
		Score:           total,
		Level:           level,
		Breakdown:       MaturityBreakdown{redScore, obsScore, secScore, resScore},
		Recommendations: recs,
	}
}

/* ── Redundancy (25 pts) ── */

func scoreRedundancy(graph security.InfraGraph, cfg *simulation.Config) float64 {
	var score float64

	hasLB := false
	computeCount := 0
	dbCount := 0
	hasReplica := false
	hasContainerCluster := false
	instancesAbove1 := 0

	for _, n := range graph.Nodes {
		switch n.NodeType {
		case "LoadBalancer", "APIGateway", "DNS":
			hasLB = true
		case "AppServer", "WebServer", "Microservice", "WorkerService", "ServerlessFunction":
			computeCount++
		case "PostgreSQLDB", "MySQLDB", "MongoDB", "Redis", "Elasticsearch":
			dbCount++
		case "Replica":
			hasReplica = true
		case "ContainerCluster":
			hasContainerCluster = true
		}
	}

	if cfg != nil {
		for _, cn := range cfg.Nodes {
			if cn.Instances > 1 {
				instancesAbove1++
			}
			if cn.ReplicationRole != "" {
				hasReplica = true
			}
		}
	}

	if hasLB {
		score += 5
	}
	if computeCount > 1 {
		score += float64(computeCount-1) * 3
		if score > 5+10 {
			score = 15
		}
	}
	if hasReplica || dbCount > 1 {
		score += 5
	}
	if hasContainerCluster {
		score += 3
	}
	if cfg != nil && instancesAbove1 >= 2 {
		score += 2
	}

	if score > 25 {
		score = 25
	}
	return score
}

/* ── Observability (25 pts) ── */

func scoreObservability(cfg *simulation.Config) float64 {
	var score float64

	if cfg == nil {
		return 5
	}

	nodesWithSLOs := 0
	for _, n := range cfg.Nodes {
		if n.SLOTargetMs > 0 || n.SLOAvailabilityTarget > 0 {
			nodesWithSLOs++
		}
	}

	if nodesWithSLOs > 0 {
		score += 10
	}
	if nodesWithSLOs >= 3 {
		score += 5
	} else if nodesWithSLOs >= 1 {
		score += 2
	}

	score += 5
	score += 5

	if score > 25 {
		score = 25
	}
	return score
}

/* ── Security (25 pts) ── */

func scoreSecurity(violations []security.SecurityViolation) float64 {
	score := 25.0
	for _, v := range violations {
		switch v.Severity {
		case security.SeverityCritical:
			score -= 5
		case security.SeverityWarning:
			score -= 2
		}
	}
	if score < 0 {
		score = 0
	}
	return score
}

/* ── Resilience (25 pts) ── */

func scoreResilience(graph security.InfraGraph, cfg *simulation.Config) float64 {
	var score float64

	hasCanary := false
	hasAutoScaling := false
	hasMultiRegion := false
	hasContainerCluster := false

	for _, n := range graph.Nodes {
		if n.NodeType == "ContainerCluster" {
			hasContainerCluster = true
		}
	}

	if cfg != nil {
		for _, cn := range cfg.Nodes {
			if cn.Region != "" && cn.Region != "us-east-1" {
				hasMultiRegion = true
			}
			if cn.Deployment.Strategy != "" {
				hasCanary = true
			}
			if cn.AutoScaling.Enabled {
				hasAutoScaling = true
			}
		}
	}

	if hasCanary {
		score += 5
	}
	if hasAutoScaling {
		score += 5
	}
	if hasMultiRegion {
		score += 5
	}
	if hasContainerCluster {
		score += 3
	}
	if cfg != nil {
		score += 5
	}

	// DNS count as additional resilience route
	hasDNS := false
	for _, n := range graph.Nodes {
		if n.NodeType == "DNS" {
			hasDNS = true
			break
		}
	}
	if hasDNS {
		score += 2
	}

	if score > 25 {
		score = 25
	}
	return score
}

/* ── Recommendations ── */

func generateRecommendations(graph security.InfraGraph, cfg *simulation.Config, violations []security.SecurityViolation, redScore, obsScore, secScore, resScore float64) []Recommendation {
	var recs []Recommendation

	hasLB := false
	computeCount := 0
	dbCount := 0
	hasReplica := false
	hasMultiRegion := false
	hasCanary := false
	hasAutoScaling := false

	for _, n := range graph.Nodes {
		switch n.NodeType {
		case "LoadBalancer", "APIGateway", "DNS":
			hasLB = true
		case "AppServer", "WebServer", "Microservice", "WorkerService", "ServerlessFunction":
			computeCount++
		case "PostgreSQLDB", "MySQLDB", "MongoDB", "Redis", "Elasticsearch":
			dbCount++
		case "Replica":
			hasReplica = true
		}
	}

	if cfg != nil {
		for _, cn := range cfg.Nodes {
			if cn.Region != "" && cn.Region != "us-east-1" {
				hasMultiRegion = true
			}
			if cn.Deployment.Strategy != "" {
				hasCanary = true
			}
			if cn.AutoScaling.Enabled {
				hasAutoScaling = true
			}
		}
	}

	// Redundancy recommendations
	if redScore < 15 {
		if !hasLB {
			recs = append(recs, Recommendation{
				Category: "redundancy",
				Message:  "Add a LoadBalancer or DNS node to distribute traffic across multiple instances and provide failover.",
				Priority: "high",
			})
		}
		if computeCount <= 1 {
			recs = append(recs, Recommendation{
				Category: "redundancy",
				Message:  fmt.Sprintf("Run at least 2 instances of each compute service. Currently %d compute node(s) found.", computeCount),
				Priority: "high",
			})
		}
		if !hasReplica && dbCount > 0 {
			recs = append(recs, Recommendation{
				Category: "redundancy",
				Message:  fmt.Sprintf("Add read replicas or a standby for your database(s) (%d found). A single database is a single point of failure.", dbCount),
				Priority: "high",
			})
		}
	}

	// Observability recommendations
	if obsScore < 15 {
		if cfg != nil {
			hasSLO := false
			for _, n := range cfg.Nodes {
				if n.SLOTargetMs > 0 || n.SLOAvailabilityTarget > 0 {
					hasSLO = true
					break
				}
			}
			if !hasSLO {
				recs = append(recs, Recommendation{
					Category: "observability",
					Message:  "Define SLO targets (latency and availability) on your nodes to track production performance against meaningful goals.",
					Priority: "high",
				})
			}
		}
		recs = append(recs, Recommendation{
			Category: "observability",
			Message:  "Configure structured logging and distributed tracing on all services. The engine supports TraceID/SpanID propagation for end-to-end visibility.",
			Priority: "medium",
		})
	}

	// Security recommendations
	if secScore < 25 {
		for _, v := range violations {
			if v.Severity == security.SeverityCritical {
				recs = append(recs, Recommendation{
					Category: "security",
					Message:  v.Message + " " + v.Remediation,
					Priority: "high",
				})
			}
		}
		for _, v := range violations {
			if v.Severity == security.SeverityWarning {
				recs = append(recs, Recommendation{
					Category: "security",
					Message:  v.Message + " " + v.Remediation,
					Priority: "medium",
				})
			}
		}
	}

	// Resilience recommendations
	if resScore < 15 {
		if !hasCanary {
			recs = append(recs, Recommendation{
				Category: "resilience",
				Message:  "Configure a deployment strategy (rolling, blue/green, or canary) for safer rollouts with automatic rollback capability.",
				Priority: "medium",
			})
		}
		if !hasAutoScaling {
			recs = append(recs, Recommendation{
				Category: "resilience",
				Message:  "Enable auto-scaling on compute nodes to handle traffic spikes without manual intervention.",
				Priority: "medium",
			})
		}
		if !hasMultiRegion {
			recs = append(recs, Recommendation{
				Category: "resilience",
				Message:  "Consider a multi-region deployment for geographic redundancy. The simulation engine supports 8 AWS regions with realistic inter-region latency.",
				Priority: "low",
			})
		}
	}

	// General recommendations if score is high but not max
	if redScore >= 20 && obsScore >= 20 && secScore >= 20 && resScore >= 20 {
		recs = append(recs, Recommendation{
			Category: "general",
			Message:  "Architecture is well-architected. Consider running chaos engineering drills (NodeFailure, LatencySpike, RegionDown) to validate resilience under real failure conditions.",
			Priority: "low",
		})
	}

	// Deduplicate by checking message prefix
	seen := make(map[string]bool)
	deduped := make([]Recommendation, 0, len(recs))
	for _, r := range recs {
		key := r.Category + ":" + truncate(r.Message, 60)
		if seen[key] {
			continue
		}
		seen[key] = true
		deduped = append(deduped, r)
	}

	return deduped
}

func truncate(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n])
}
