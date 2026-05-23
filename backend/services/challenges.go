package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"time"

	"systemdesign/models"
	"systemdesign/simulation"

	"github.com/google/uuid"
)

func SeedChallenges(db *sql.DB) error {
	var count int
	err := db.QueryRow(`SELECT COUNT(*) FROM challenges`).Scan(&count)
	if err != nil || count > 0 {
		return err
	}

	challenges := []struct {
		Title       string
		Desc        string
		Difficulty  string
		TimeLimit   int
		Requirements map[string]any
		InitialCanvas json.RawMessage
		PassingCriteria json.RawMessage
	}{
		{
			Title: "Design a URL Shortener", Difficulty: "medium", TimeLimit: 1800,
			Desc: "Design a scalable URL shortening service. Must handle 10k RPS with <100ms latency. Include a load balancer, web servers, and a database.",
			Requirements: map[string]any{"targetRPS": 10000.0, "maxLatencyMs": 100.0, "nodeTypes": []string{"LoadBalancer", "WebServer", "PostgreSQLDB"}},
			InitialCanvas: json.RawMessage(`{"nodes":[{"id":"lb-1","type":"default","position":{"x":100,"y":200},"data":{"nodeType":"LoadBalancer","label":"Load Balancer","config":{"instances":1,"maxRPS":50000,"latencyMs":1,"errorRate":0}}},{"id":"web-1","type":"default","position":{"x":400,"y":100},"data":{"nodeType":"WebServer","label":"Web Server","config":{"instances":3,"maxRPS":4000,"latencyMs":20,"errorRate":0}}},{"id":"web-2","type":"default","position":{"x":400,"y":300},"data":{"nodeType":"WebServer","label":"Web Server 2","config":{"instances":3,"maxRPS":4000,"latencyMs":20,"errorRate":0}}},{"id":"db-1","type":"default","position":{"x":700,"y":200},"data":{"nodeType":"PostgreSQLDB","label":"Database","config":{"instances":2,"maxRPS":10000,"latencyMs":5,"errorRate":0}}}}],"edges":[{"id":"lb-web1","source":"lb-1","target":"web-1","data":{"routing":{"trafficPercent":50,"isSync":true,"requiresTLS":false}}},{"id":"lb-web2","source":"lb-1","target":"web-2","data":{"routing":{"trafficPercent":50,"isSync":true,"requiresTLS":false}}},{"id":"web1-db","source":"web-1","target":"db-1","data":{"routing":{"trafficPercent":100,"isSync":true,"requiresTLS":false}}},{"id":"web2-db","source":"web-2","target":"db-1","data":{"routing":{"trafficPercent":100,"isSync":true,"requiresTLS":false}}}]}`),
			PassingCriteria: json.RawMessage(`{"minCostScore":30,"minReliabilityScore":40,"minPerformanceScore":50}`),
		},
		{
			Title: "Build a Chat System", Difficulty: "hard", TimeLimit: 2700,
			Desc: "Design a real-time chat system with WebSocket support. Target <50ms p99 latency. Include a WebSocket gateway, message queue, and database.",
			Requirements: map[string]any{"maxP99Latency": 50.0, "features": []string{"WebSocket", "message_queue", "database"}, "nodeTypes": []string{"LoadBalancer", "AppServer", "MessageQueue", "Redis"}},
			InitialCanvas: json.RawMessage(`{"nodes":[{"id":"lb-1","type":"default","position":{"x":100,"y":200},"data":{"nodeType":"LoadBalancer","label":"WS Gateway LB","config":{"instances":2,"maxRPS":50000,"latencyMs":1,"errorRate":0}}},{"id":"app-1","type":"default","position":{"x":400,"y":100},"data":{"nodeType":"AppServer","label":"Chat Server","config":{"instances":4,"maxRPS":5000,"latencyMs":15,"errorRate":0}}},{"id":"mq-1","type":"default","position":{"x":400,"y":300},"data":{"nodeType":"MessageQueue","label":"Message Queue","config":{"instances":2,"maxRPS":20000,"latencyMs":10,"errorRate":0}}},{"id":"cache-1","type":"default","position":{"x":700,"y":100},"data":{"nodeType":"Redis","label":"Redis Cache","config":{"instances":2,"maxRPS":50000,"latencyMs":2,"errorRate":0}}},{"id":"db-1","type":"default","position":{"x":700,"y":300},"data":{"nodeType":"PostgreSQLDB","label":"Database","config":{"instances":2,"maxRPS":10000,"latencyMs":5,"errorRate":0}}}}],"edges":[{"id":"lb-app","source":"lb-1","target":"app-1","data":{"routing":{"trafficPercent":100,"isSync":true,"requiresTLS":true}}},{"id":"app-mq","source":"app-1","target":"mq-1","data":{"routing":{"trafficPercent":100,"isSync":false,"requiresTLS":false}}},{"id":"app-cache","source":"app-1","target":"cache-1","data":{"routing":{"trafficPercent":100,"isSync":true,"requiresTLS":false}}},{"id":"app-db","source":"app-1","target":"db-1","data":{"routing":{"trafficPercent":100,"isSync":true,"requiresTLS":false}}}]}`),
			PassingCriteria: json.RawMessage(`{"minCostScore":25,"minReliabilityScore":50,"minPerformanceScore":60}`),
		},
		{
			Title: "E-commerce Checkout", Difficulty: "hard", TimeLimit: 2400,
			Desc: "Design an e-commerce checkout flow that survives payment gateway failures with 0% data loss. Include async processing via message queue.",
			Requirements: map[string]any{"surviveFailure": "payment_gateway", "zeroDataLoss": true, "nodeTypes": []string{"LoadBalancer", "AppServer", "MessageQueue", "PostgreSQLDB"}},
			InitialCanvas: json.RawMessage(`{"nodes":[{"id":"lb-1","type":"default","position":{"x":100,"y":200},"data":{"nodeType":"LoadBalancer","label":"Checkout LB","config":{"instances":2,"maxRPS":30000,"latencyMs":1,"errorRate":0}}},{"id":"app-1","type":"default","position":{"x":400,"y":100},"data":{"nodeType":"AppServer","label":"Checkout Service","config":{"instances":3,"maxRPS":3000,"latencyMs":30,"errorRate":0}}},{"id":"mq-1","type":"default","position":{"x":400,"y":300},"data":{"nodeType":"MessageQueue","label":"Order Queue","config":{"instances":2,"maxRPS":15000,"latencyMs":10,"errorRate":0}}},{"id":"db-1","type":"default","position":{"x":700,"y":200},"data":{"nodeType":"PostgreSQLDB","label":"Orders DB","config":{"instances":2,"maxRPS":8000,"latencyMs":5,"errorRate":0}}},{"id":"payment-1","type":"default","position":{"x":700,"y":100},"data":{"nodeType":"ThirdPartyAPI","label":"Payment Gateway","config":{"instances":1,"maxRPS":2000,"latencyMs":200,"errorRate":0.02}}}]}`),
			PassingCriteria: json.RawMessage(`{"minCostScore":20,"minReliabilityScore":60,"minPerformanceScore":40}`),
		},
		{
			Title: "DR Drill: Region Outage", Difficulty: "expert", TimeLimit: 900,
			Desc: "Design a multi-region architecture that survives a complete region outage. Must maintain <10% error rate during the failure.",
			Requirements: map[string]any{"surviveScenario": "region_down", "maxErrorRate": 0.10, "nodeTypes": []string{"LoadBalancer", "AppServer", "PostgreSQLDB", "Redis"}},
			InitialCanvas: json.RawMessage(`{"nodes":[{"id":"lb-primary","type":"default","position":{"x":100,"y":100},"data":{"nodeType":"LoadBalancer","label":"Primary LB","config":{"instances":2,"maxRPS":30000,"latencyMs":1,"errorRate":0}}},{"id":"lb-dr","type":"default","position":{"x":100,"y":300},"data":{"nodeType":"LoadBalancer","label":"DR LB","config":{"instances":1,"maxRPS":15000,"latencyMs":1,"errorRate":0}}},{"id":"app-1","type":"default","position":{"x":400,"y":50},"data":{"nodeType":"AppServer","label":"Primary App","config":{"instances":4,"maxRPS":4000,"latencyMs":20,"errorRate":0}}},{"id":"app-2","type":"default","position":{"x":400,"y":200},"data":{"nodeType":"AppServer","label":"DR App","config":{"instances":2,"maxRPS":2000,"latencyMs":25,"errorRate":0}}},{"id":"db-1","type":"default","position":{"x":700,"y":50},"data":{"nodeType":"PostgreSQLDB","label":"Primary DB","config":{"instances":2,"maxRPS":10000,"latencyMs":5,"errorRate":0}}},{"id":"db-dr","type":"default","position":{"x":700,"y":250},"data":{"nodeType":"PostgreSQLDB","label":"DR DB","config":{"instances":1,"maxRPS":5000,"latencyMs":10,"errorRate":0}}},{"id":"cache-1","type":"default","position":{"x":700,"y":400},"data":{"nodeType":"Redis","label":"DR Cache","config":{"instances":1,"maxRPS":20000,"latencyMs":2,"errorRate":0}}}]}`),
			PassingCriteria: json.RawMessage(`{"minCostScore":30,"minReliabilityScore":70,"minPerformanceScore":30}`),
		},
	}

	for _, c := range challenges {
		reqJSON, _ := json.Marshal(c.Requirements)
		passJSON, _ := json.Marshal(c.PassingCriteria)
		_, err := db.Exec(
			`INSERT INTO challenges (title, description, difficulty, requirements, initial_canvas, time_limit_seconds, passing_criteria)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			c.Title, c.Desc, c.Difficulty, reqJSON, c.InitialCanvas, c.TimeLimit, passJSON,
		)
		if err != nil {
			return fmt.Errorf("failed to seed challenge %q: %w", c.Title, err)
		}
	}

	return nil
}

func ListChallenges(db *sql.DB) ([]models.ChallengeResponse, error) {
	rows, err := db.Query(
		`SELECT id, title, description, difficulty, requirements, initial_canvas, time_limit_seconds, passing_criteria
		 FROM challenges ORDER BY created_at ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]models.ChallengeResponse, 0)
	for rows.Next() {
		var cr models.ChallengeResponse
		var tc int
		if err := rows.Scan(&cr.ID, &cr.Title, &cr.Description, &cr.Difficulty,
			&cr.Requirements, &cr.InitialCanvas, &tc, &cr.PassingCriteria); err != nil {
			continue
		}
		cr.TimeLimitSeconds = tc
		results = append(results, cr)
	}
	return results, nil
}

func GetChallengeByID(db *sql.DB, challengeID string) (*models.Challenge, error) {
	var c models.Challenge
	err := db.QueryRow(
		`SELECT id, title, description, difficulty, requirements, initial_canvas, time_limit_seconds, passing_criteria, created_at
		 FROM challenges WHERE id = $1`, challengeID,
	).Scan(&c.ID, &c.Title, &c.Description, &c.Difficulty,
		&c.Requirements, &c.InitialCanvas, &c.TimeLimitSeconds, &c.PassingCriteria, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func CreateProjectFromCanvas(db *sql.DB, userID string, canvasJSON json.RawMessage, challengeID, challengeTitle string) (*models.ProjectResponse, error) {
	name := fmt.Sprintf("Challenge: %s", challengeTitle)
	defaultDesc := fmt.Sprintf("Challenge submission for %s", challengeTitle)
	now := time.Now()

	var p models.Project
	err := db.QueryRow(
		`INSERT INTO projects (user_id, name, description, is_public, canvas_data, created_at, updated_at)
		 VALUES ($1, $2, $3, false, $4::jsonb, $5, $6)
		 RETURNING id, user_id, name, description, is_public, created_at, updated_at`,
		userID, name, defaultDesc, canvasJSON, now, now,
	).Scan(&p.ID, &p.UserID, &p.Name, &p.Description, &p.IsPublic, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &models.ProjectResponse{
		ID: p.ID, UserID: p.UserID, Name: p.Name,
		Description: p.Description, IsPublic: p.IsPublic,
		CreatedAt: p.CreatedAt, UpdatedAt: p.UpdatedAt,
	}, nil
}

type ScoreReport struct {
	Cost        float64 `json:"cost"`
	Reliability float64 `json:"reliability"`
	Performance float64 `json:"performance"`
	Total       float64 `json:"total"`
	Passed      bool    `json:"passed"`
}

func ScoreSubmission(canvasData []byte, challenge *models.Challenge) (*ScoreReport, error) {
	var canvas struct {
		Nodes []struct {
			ID   string `json:"id"`
			Data struct {
				NodeType string         `json:"nodeType"`
				Label    string         `json:"label"`
				Config   map[string]any `json:"config"`
			} `json:"data"`
		} `json:"nodes"`
		Edges []struct {
			ID     string `json:"id"`
			Source string `json:"source"`
			Target string `json:"target"`
			Data   struct {
				Routing map[string]any `json:"routing"`
			} `json:"data"`
		} `json:"edges"`
	}
	if err := json.Unmarshal(canvasData, &canvas); err != nil {
		return nil, fmt.Errorf("failed to parse canvas: %w", err)
	}

	var criteria struct {
		MinCostScore        float64 `json:"minCostScore"`
		MinReliabilityScore float64 `json:"minReliabilityScore"`
		MinPerformanceScore float64 `json:"minPerformanceScore"`
	}
	if err := json.Unmarshal(challenge.PassingCriteria, &criteria); err != nil {
		criteria = struct {
			MinCostScore        float64 `json:"minCostScore"`
			MinReliabilityScore float64 `json:"minReliabilityScore"`
			MinPerformanceScore float64 `json:"minPerformanceScore"`
		}{MinCostScore: 20, MinReliabilityScore: 40, MinPerformanceScore: 40}
	}

	simNodes := make([]simulation.Node, 0)
	for _, n := range canvas.Nodes {
		if n.Data.NodeType == "ExternalClient" || n.Data.NodeType == "ThirdPartyAPI" ||
			n.Data.NodeType == "MobileClient" || n.Data.NodeType == "WebBrowser" {
			continue
		}
		node := simulation.Node{
			ID:       n.ID,
			NodeType: simulation.NodeType(n.Data.NodeType),
			Label:    n.Data.Label,
		}
		if v, ok := n.Data.Config["instances"].(float64); ok {
			node.Instances = int(v)
		}
		if v, ok := n.Data.Config["maxRPS"].(float64); ok {
			node.MaxRPS = v
		}
		if v, ok := n.Data.Config["latencyMs"].(float64); ok {
			node.LatencyMs = v
		}
		if v, ok := n.Data.Config["errorRate"].(float64); ok {
			node.ErrorRate = v
		}
		if node.MaxRPS <= 0 {
			node.MaxRPS = 1000
		}
		if node.Instances <= 0 {
			node.Instances = 1
		}
		simNodes = append(simNodes, node)
	}

	if len(simNodes) == 0 {
		return nil, fmt.Errorf("no billable/scorable nodes in canvas")
	}

	simEdges := make([]simulation.Edge, 0)
	for _, e := range canvas.Edges {
		edge := simulation.Edge{ID: e.ID, Source: e.Source, Target: e.Target, TrafficPercent: 100}
		if e.Data.Routing != nil {
			if p, ok := e.Data.Routing["trafficPercent"].(float64); ok {
				edge.TrafficPercent = p
			}
			if s, ok := e.Data.Routing["isSync"].(bool); ok {
				edge.IsSync = s
			}
		}
		simEdges = append(simEdges, edge)
	}

	chaosMgr := simulation.NewChaosManager()

	config := &simulation.Config{
		ProjectID:       uuid.New().String(),
		Nodes:           simNodes,
		Edges:           simEdges,
		TargetRPS:       5000,
		DurationSeconds: 30,
		SpeedMultiplier: 5,
		Pattern:         simulation.TrafficSteady,
		TickRateMs:      100,
	}

	engine := simulation.NewEngine(config)
	engine.RunID = uuid.New().String()
	engine.SetChaosManager(chaosMgr)

	var finalTick *simulation.Tick
	engine.OnTick(func(tick simulation.Tick, tickNum int) {
		if tickNum%10 == 0 {
			t := tick
			finalTick = &t
		}
	})

	engine.Start()

	reliabilityEvents := []simulation.ChaosEventType{
		simulation.ChaosNodeFailure, simulation.ChaosLatencySpike, simulation.ChaosErrorRateSpike,
	}

	time.Sleep(500 * time.Millisecond)

	affectedNodeIDs := make([]string, 0)
	for _, n := range simNodes {
		affectedNodeIDs = append(affectedNodeIDs, n.ID)
	}

	for i, chaosType := range reliabilityEvents {
		if i >= len(affectedNodeIDs) {
			break
		}
		nodeID := affectedNodeIDs[i%len(affectedNodeIDs)]
		event := &simulation.ChaosEvent{
			ID:              uuid.New().String(),
			SimulationRunID: engine.RunID,
			NodeID:          nodeID,
			EventType:       chaosType,
			Severity:        0.5,
			DurationTicks:   100,
			StartedAt:       engine.CurrentTick(),
			Active:          true,
		}
		chaosMgr.Inject(event)
		time.Sleep(200 * time.Millisecond)
	}

	for j := 0; j < 20; j++ {
		time.Sleep(100 * time.Millisecond)
	}

	engine.Stop()

	if finalTick == nil {
		return nil, fmt.Errorf("no tick data collected")
	}

	costScore := calculateCostScore(simNodes)
	reliabilityScore := calculateReliabilityScore(finalTick)
	performanceScore := calculatePerformanceScore(finalTick, 5000)
	total := (costScore + reliabilityScore + performanceScore) / 3.0
	total = math.Round(total*100) / 100

	var reqs struct {
		TargetRPS float64 `json:"targetRPS"`
		MaxLatency float64 `json:"maxLatencyMs"`
	}
	if err := json.Unmarshal(challenge.Requirements, &reqs); err == nil && reqs.TargetRPS > 0 {
		performanceScore = calculatePerformanceScore(finalTick, reqs.TargetRPS)
		total = (costScore + reliabilityScore + performanceScore) / 3.0
		total = math.Round(total*100) / 100
	}

	passed := costScore >= criteria.MinCostScore &&
		reliabilityScore >= criteria.MinReliabilityScore &&
		performanceScore >= criteria.MinPerformanceScore

	return &ScoreReport{
		Cost:        math.Round(costScore*100) / 100,
		Reliability: math.Round(reliabilityScore*100) / 100,
		Performance: math.Round(performanceScore*100) / 100,
		Total:       total,
		Passed:      passed,
	}, nil
}

func calculateCostScore(nodes []simulation.Node) float64 {
	totalInstances := 0
	for _, n := range nodes {
		totalInstances += n.Instances
	}
	if totalInstances <= 0 {
		return 100
	}
	if totalInstances <= 3 {
		return 100
	}
	if totalInstances <= 6 {
		return 80
	}
	if totalInstances <= 10 {
		return 60
	}
	if totalInstances <= 15 {
		return 40
	}
	return math.Max(0, 100-float64(totalInstances)*3)
}

func calculateReliabilityScore(finalTick *simulation.Tick) float64 {
	if finalTick == nil {
		return 0
	}
	errorRate := finalTick.GlobalErrorRate
	if errorRate <= 0.01 {
		return 100
	}
	if errorRate <= 0.03 {
		return 85
	}
	if errorRate <= 0.05 {
		return 60
	}
	if errorRate <= 0.10 {
		return 40
	}
	return math.Max(0, 100-errorRate*200)
}

func calculatePerformanceScore(finalTick *simulation.Tick, targetRPS float64) float64 {
	if finalTick == nil || targetRPS <= 0 {
		return 50
	}
	achievedRPS := finalTick.TotalRPS
	bottleneckCount := 0
	for _, m := range finalTick.NodeMetrics {
		if m.IsBottleneck {
			bottleneckCount++
		}
	}

	ratio := achievedRPS / targetRPS
	if ratio >= 1.0 {
		score := 100.0
		if bottleneckCount > 0 {
			score -= float64(bottleneckCount) * 10
		}
		return math.Max(score, 0)
	}
	score := ratio * 100
	if bottleneckCount > 0 {
		score -= float64(bottleneckCount) * 10
	}
	return math.Max(score, 0)
}

func SaveSubmission(db *sql.DB, userID, challengeID, projectID string, score *ScoreReport) (*models.ChallengeSubmission, error) {
	var s models.ChallengeSubmission
	err := db.QueryRow(
		`INSERT INTO challenge_submissions (challenge_id, user_id, project_id, score, passed)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, challenge_id, user_id, project_id, score, passed, submitted_at`,
		challengeID, userID, projectID, score.Total, score.Passed,
	).Scan(&s.ID, &s.ChallengeID, &s.UserID, &s.ProjectID, &s.Score, &s.Passed, &s.SubmittedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func GetLeaderboard(db *sql.DB, limit int) ([]models.LeaderboardEntry, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := db.Query(
		`SELECT u.username, cs.score, cs.passed, cs.submitted_at
		 FROM challenge_submissions cs
		 JOIN users u ON u.id = cs.user_id
		 ORDER BY cs.score DESC, cs.submitted_at ASC
		 LIMIT $1`, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := make([]models.LeaderboardEntry, 0, limit)
	rank := 1
	for rows.Next() {
		var e models.LeaderboardEntry
		if err := rows.Scan(&e.Username, &e.Score, &e.Passed, &e.SubmittedAt); err != nil {
			continue
		}
		e.Rank = rank
		rank++
		entries = append(entries, e)
	}
	return entries, nil
}

func randRange(min, max int) int {
	if max <= min {
		return min
	}
	return min + rand.Intn(max-min)
}
