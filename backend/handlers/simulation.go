package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"math"
	"sync"
	"time"

	"github.com/fasthttp/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/valyala/fasthttp"
	"systemdesign/config"
	"systemdesign/models"
	"systemdesign/services"
	"systemdesign/services/sre"
	"systemdesign/simulation"
	"systemdesign/ws"
)

type SimRun struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"projectId"`
	UserID    string    `json:"userId"`
	Config    string    `json:"config"`
	Status    string    `json:"status"`
	StartedAt time.Time `json:"startedAt"`
	StoppedAt *time.Time `json:"stoppedAt,omitempty"`
}

type SimulationHandler struct {
	DB      *sql.DB
	Redis   *redis.Client
	Hub     *ws.Hub
	Chaos   *simulation.ChaosManager
	engines map[string]*simulation.Engine
	mu      sync.Mutex
}

func NewSimulationHandler(db *sql.DB, rdb *redis.Client, hub *ws.Hub, chaos *simulation.ChaosManager) *SimulationHandler {
	return &SimulationHandler{
		DB:      db,
		Redis:   rdb,
		Hub:     hub,
		Chaos:   chaos,
		engines: make(map[string]*simulation.Engine),
	}
}

type StartSimRequest struct {
	ProjectID       string  `json:"projectId"`
	TargetRPS       float64 `json:"targetRPS"`
	DurationSeconds int     `json:"durationSeconds"`
	SpeedMultiplier float64 `json:"speedMultiplier"`
	TrafficPattern  string  `json:"trafficPattern"`
}

type canvasNodeData struct {
	NodeType string                 `json:"nodeType"`
	Label    string                 `json:"label"`
	Config   map[string]any         `json:"config"`
	SimState map[string]any         `json:"simulationState"`
	Metrics  map[string]any         `json:"metrics"`
}

type canvasEdgeData struct {
	Routing map[string]any `json:"routing"`
}

func parseCanvasToSimNodes(proj *models.ProjectDetailResponse) ([]simulation.Node, []simulation.Edge, error) {
	raw, err := json.Marshal(proj.CanvasData)
	if err != nil {
		return nil, nil, err
	}

	var canvas struct {
		Nodes []struct {
			ID       string         `json:"id"`
			Data     canvasNodeData `json:"data"`
		} `json:"nodes"`
		Edges []struct {
			ID     string         `json:"id"`
			Source string         `json:"source"`
			Target string         `json:"target"`
			Data   canvasEdgeData `json:"data"`
		} `json:"edges"`
	}
	if err := json.Unmarshal(raw, &canvas); err != nil {
		return nil, nil, err
	}

	nodes := make([]simulation.Node, 0, len(canvas.Nodes))
	for _, cn := range canvas.Nodes {
		n := simulation.Node{
			ID:       cn.ID,
			NodeType: simulation.NodeType(cn.Data.NodeType),
			Label:    cn.Data.Label,
		}
		if cfg, ok := cn.Data.Config["instances"]; ok {
			if v, ok := cfg.(float64); ok {
				n.Instances = int(v)
			}
		}
		if cfg, ok := cn.Data.Config["maxRPS"]; ok {
			if v, ok := cfg.(float64); ok {
				n.MaxRPS = v
			}
		}
		if cfg, ok := cn.Data.Config["latencyMs"]; ok {
			if v, ok := cfg.(float64); ok {
				n.LatencyMs = v
			}
		}
		if cfg, ok := cn.Data.Config["errorRate"]; ok {
			if v, ok := cfg.(float64); ok {
				n.ErrorRate = v
			}
		}
		if cfg, ok := cn.Data.Config["region"]; ok {
			if v, ok := cfg.(string); ok {
				n.Region = v
			}
		}
		if cfg, ok := cn.Data.Config["isFailed"]; ok {
			if v, ok := cfg.(bool); ok {
				n.IsFailed = v
			}
		}
		if cfg, ok := cn.Data.Config["deployment"]; ok {
			if depMap, ok := cfg.(map[string]any); ok {
				if s, ok := depMap["strategy"].(string); ok {
					n.Deployment.Strategy = simulation.DeploymentStrategy(s)
				}
				if p, ok := depMap["canaryPercent"].(float64); ok {
					n.Deployment.CanaryPercent = p
				}
				if v, ok := depMap["canaryVersion"].(string); ok {
					n.Deployment.CanaryVersion = v
				}
				if a, ok := depMap["isCanaryActive"].(bool); ok {
					n.Deployment.IsCanaryActive = a
				}
			}
		}
		if cfg, ok := cn.Data.Config["security"]; ok {
			if secMap, ok := cfg.(map[string]any); ok {
				if p, ok := secMap["isPublicFacing"].(bool); ok {
					n.Security.IsPublicFacing = p
				}
				if t, ok := secMap["requiresTLS"].(bool); ok {
					n.Security.RequiresTLS = t
				}
				if v, ok := secMap["vpcId"].(string); ok {
					n.Security.VpcID = v
				}
				if inbound, ok := secMap["allowedInbound"].([]any); ok {
					for _, id := range inbound {
						if s, ok := id.(string); ok {
							n.Security.AllowedInbound = append(n.Security.AllowedInbound, s)
						}
					}
				}
			}
		}

		if cfg, ok := cn.Data.Config["cacheHitRatio"]; ok {
			if v, ok := cfg.(float64); ok {
				n.CacheHitRatio = v
			}
		}
		if cfg, ok := cn.Data.Config["connectionPoolMax"]; ok {
			if v, ok := cfg.(float64); ok {
				n.ConnectionPoolMax = int(v)
			}
		}
		if cfg, ok := cn.Data.Config["coldStartMs"]; ok {
			if v, ok := cfg.(float64); ok {
				n.ColdStartMs = v
			}
		}
		if cfg, ok := cn.Data.Config["diskIOPSMax"]; ok {
			if v, ok := cfg.(float64); ok {
				n.DiskIOPSMax = v
			}
		}
		if cfg, ok := cn.Data.Config["isPrimaryDB"]; ok {
			if v, ok := cfg.(bool); ok {
				n.IsPrimaryDB = v
			}
		}

		if cfg, ok := cn.Data.Config["sloTargetMs"]; ok {
			if v, ok := cfg.(float64); ok {
				n.SLOTargetMs = v
			}
		}
		if cfg, ok := cn.Data.Config["sloAvailabilityTarget"]; ok {
			if v, ok := cfg.(float64); ok {
				n.SLOAvailabilityTarget = v
			}
		}

		// Start with defaults for all AutoScaling sub-fields, then override from JSON
		n.AutoScaling = simulation.DefaultAutoScaling()
		if cfg, ok := cn.Data.Config["replicationRole"]; ok {
			if v, ok := cfg.(string); ok {
				n.ReplicationRole = v
			}
		}
		if cfg, ok := cn.Data.Config["replicationLagMs"]; ok {
			if v, ok := cfg.(float64); ok {
				n.ReplicationLagMs = v
			}
		}
		if cfg, ok := cn.Data.Config["computeTier"]; ok {
			if v, ok := cfg.(string); ok {
				n.ComputeTier = v
			}
		}

		if cfg, ok := cn.Data.Config["autoScaling"]; ok {
			if asMap, ok := cfg.(map[string]any); ok {
				if e, ok := asMap["enabled"].(bool); ok {
					n.AutoScaling.Enabled = e
				}
				if v, ok := asMap["minInstances"].(float64); ok {
					n.AutoScaling.MinInstances = int(v)
				}
				if v, ok := asMap["maxInstances"].(float64); ok {
					n.AutoScaling.MaxInstances = int(v)
				}
				if v, ok := asMap["targetCPUPercent"].(float64); ok {
					n.AutoScaling.TargetCPUPercent = v
				}
				if v, ok := asMap["targetMemPercent"].(float64); ok {
					n.AutoScaling.TargetMemPercent = v
				}
				if v, ok := asMap["cooldownTicks"].(float64); ok {
					n.AutoScaling.CooldownTicks = int(v)
				}
				if v, ok := asMap["scaleUpFactor"].(float64); ok {
					n.AutoScaling.ScaleUpFactor = v
				}
				if v, ok := asMap["scaleDownFactor"].(float64); ok {
					n.AutoScaling.ScaleDownFactor = v
				}
			}
		}

		if n.MaxRPS <= 0 {
			n.MaxRPS = 1000
		}
		if n.Instances <= 0 {
			n.Instances = 1
		}
		if n.ConnectionPoolMax <= 0 {
			n.ConnectionPoolMax = 100
		}
		if n.ColdStartMs <= 0 {
			n.ColdStartMs = 500
		}
		if n.DiskIOPSMax <= 0 {
			n.DiskIOPSMax = 3000
		}

		nodes = append(nodes, n)
	}

	edges := make([]simulation.Edge, 0, len(canvas.Edges))
	for _, ce := range canvas.Edges {
		e := simulation.Edge{
			ID:             ce.ID,
			Source:         ce.Source,
			Target:         ce.Target,
			TrafficPercent: 100,
		}
		if ce.Data.Routing != nil {
			if p, ok := ce.Data.Routing["trafficPercent"].(float64); ok {
				e.TrafficPercent = p
			}
			if s, ok := ce.Data.Routing["isSync"].(bool); ok {
				e.IsSync = s
			}
			if t, ok := ce.Data.Routing["requiresTLS"].(bool); ok {
				e.RequiresTLS = t
			}
			if p, ok := ce.Data.Routing["protocol"].(string); ok {
				e.Protocol = p
			}
			if p, ok := ce.Data.Routing["packetLoss"].(float64); ok {
				e.PacketLossPercent = p
			}
			if j, ok := ce.Data.Routing["jitterMs"].(float64); ok {
				e.JitterMs = j
			}
		}
		edges = append(edges, e)
	}

	return nodes, edges, nil
}

var wsUpgrader = websocket.FastHTTPUpgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(_ *fasthttp.RequestCtx) bool { return true },
}

func (h *SimulationHandler) WSHandler(c *fiber.Ctx) error {
	ticket := c.Query("ticket")
	projectID := c.Query("projectId")

	if ticket == "" || projectID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "ticket and projectId query params required"})
	}

	auth := ws.ValidateTicket(h.Redis, ticket)
	if !auth.OK {
		return c.Status(401).JSON(fiber.Map{"error": "invalid or expired ticket"})
	}

	claims := auth.UserID

	err := wsUpgrader.Upgrade(c.Context(), func(conn *websocket.Conn) {
		client := ws.NewClient(conn, h.Hub, projectID, claims)
		h.Hub.Register(client)
		go client.WritePump()
		client.ReadPump()
	})
	if err != nil {
		log.Printf("ws upgrade error: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "websocket upgrade failed"})
	}
	return nil
}

func (h *SimulationHandler) Start(c *fiber.Ctx) error {
	claims := c.Locals("user").(*config.JWTClaims)

	var req StartSimRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.ProjectID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "projectId is required"})
	}
	if req.TargetRPS <= 0 {
		req.TargetRPS = 1000
	}
	if req.DurationSeconds <= 0 {
		req.DurationSeconds = 60
	}
	if req.SpeedMultiplier <= 0 {
		req.SpeedMultiplier = 1
	}
	pattern := simulation.TrafficSteady
	switch req.TrafficPattern {
	case "ramp_up":
		pattern = simulation.TrafficRampUp
	case "spike":
		pattern = simulation.TrafficSpike
	}

	proj, err := services.GetProjectByID(h.DB, claims.UserID, req.ProjectID)
	if err != nil {
		code := 400
		if err == services.ErrProjectNotFound || err == services.ErrForbidden {
			code = 404
		}
		return c.Status(code).JSON(fiber.Map{"error": err.Error()})
	}

	nodes, edges, err := parseCanvasToSimNodes(proj)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to parse canvas data"})
	}

	if len(nodes) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "canvas has no nodes"})
	}

	cfg := &simulation.Config{
		ProjectID:       req.ProjectID,
		Nodes:           nodes,
		Edges:           edges,
		TargetRPS:       req.TargetRPS,
		DurationSeconds: req.DurationSeconds,
		SpeedMultiplier: req.SpeedMultiplier,
		Pattern:         pattern,
		TickRateMs:      100,
	}

	engine := simulation.NewEngine(cfg)
	runID := uuid.New().String()
	engine.RunID = runID
	engine.SetChaosManager(h.Chaos)

	throttleThreshold := 50
	lastTick := time.Now()

	engine.OnTick(func(tick simulation.Tick, tickNum int) {
		if len(nodes) > throttleThreshold {
			if time.Since(lastTick) >= 200*time.Millisecond {
				h.Hub.BroadcastToProject(req.ProjectID, &tick)
				lastTick = time.Now()
			}
		} else {
			h.Hub.BroadcastToProject(req.ProjectID, &tick)
		}

		h.storeTick(runID, tickNum, &tick)
	})

	engine.Start()

	h.mu.Lock()
	h.engines[runID] = engine
	h.mu.Unlock()

	h.storeRun(runID, req.ProjectID, claims.UserID, cfg)

	return c.Status(201).JSON(fiber.Map{
		"simulationRunId": runID,
		"status":          "running",
		"totalTicks":      cfg.DurationSeconds * 1000 / cfg.TickRateMs,
	})
}

func (h *SimulationHandler) Stop(c *fiber.Ctx) error {
	runID := c.Params("id")
	if runID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "simulation run ID required"})
	}

	h.mu.Lock()
	engine, ok := h.engines[runID]
	delete(h.engines, runID)
	h.mu.Unlock()

	if !ok {
		engine := h.findEngineFromDB(runID)
		if engine == nil {
			return c.Status(404).JSON(fiber.Map{"error": "simulation run not found"})
		}
		if !engine.IsRunning() {
			return c.JSON(fiber.Map{"status": "already_stopped"})
		}
	}

	engine.Stop()

	now := time.Now()
	h.DB.Exec(`UPDATE simulation_runs SET status='stopped', stopped_at=$1 WHERE id=$2`, now, runID)

	return c.JSON(fiber.Map{"status": "stopped"})
}

func (h *SimulationHandler) History(c *fiber.Ctx) error {
	projectID := c.Params("projectId")
	if projectID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "projectId is required"})
	}

	rows, err := h.DB.Query(
		`SELECT id, project_id, user_id, config, status, started_at, stopped_at
		 FROM simulation_runs WHERE project_id = $1 ORDER BY started_at DESC LIMIT 50`,
		projectID,
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to query simulation history"})
	}
	defer rows.Close()

	runs := make([]SimRun, 0)
	for rows.Next() {
		var r SimRun
		var stoppedAt sql.NullTime
		if err := rows.Scan(&r.ID, &r.ProjectID, &r.UserID, &r.Config, &r.Status, &r.StartedAt, &stoppedAt); err != nil {
			continue
		}
		if stoppedAt.Valid {
			r.StoppedAt = &stoppedAt.Time
		}
		runs = append(runs, r)
	}

	return c.JSON(fiber.Map{"runs": runs})
}

func (h *SimulationHandler) storeRun(runID, projectID, userID string, cfg *simulation.Config) {
	cfgJSON, _ := json.Marshal(cfg)
	h.DB.Exec(
		`INSERT INTO simulation_runs (id, project_id, user_id, config, status, started_at)
		 VALUES ($1, $2, $3, $4, 'running', $5)`,
		runID, projectID, userID, string(cfgJSON), time.Now(),
	)
}

func (h *SimulationHandler) GetSLOReport(c *fiber.Ctx) error {
	runID := c.Params("id")
	if runID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "simulation run ID required"})
	}

	engine := h.FindEngine(runID)
	if engine == nil || !engine.IsRunning() {
		return c.Status(404).JSON(fiber.Map{"error": "simulation run not found or not running"})
	}

	report := sre.GenerateSLOReport(engine)
	return c.JSON(report)
}

type FailoverTestRequest struct {
	ProjectID     string `json:"projectId"`
	FailingRegion string `json:"failingRegion"`
}

type FailoverTestResponse struct {
	SimulationRunID string   `json:"simulationRunId"`
	FailingRegion   string   `json:"failingRegion"`
	AffectedNodes   []string `json:"affectedNodes"`
	ReplicaCount    int      `json:"replicaCount"`
	InjectedEvents  int      `json:"injectedEvents"`
	DNSDelayTicks   int      `json:"dnsDelayTicks"`
	Status          string   `json:"status"`
}

func (h *SimulationHandler) FailoverTest(c *fiber.Ctx) error {
	var req FailoverTestRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if req.ProjectID == "" || req.FailingRegion == "" {
		return c.Status(400).JSON(fiber.Map{"error": "projectId and failingRegion are required"})
	}

	// Find the latest running simulation for this project
	var runID string
	err := h.DB.QueryRow(
		`SELECT id FROM simulation_runs WHERE project_id = $1 AND status = 'running' ORDER BY started_at DESC LIMIT 1`,
		req.ProjectID,
	).Scan(&runID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "no running simulation found for project"})
	}

	engine := h.FindEngine(runID)
	if engine == nil || !engine.IsRunning() {
		return c.Status(404).JSON(fiber.Map{"error": "simulation run not found or not running"})
	}

	cfg := engine.Config()
	nodeMap := engine.GetNodeMap()
	var affectedNodeIDs []string
	var injectedCount int

	for i := range cfg.Nodes {
		if cfg.Nodes[i].Region == req.FailingRegion {
			affectedNodeIDs = append(affectedNodeIDs, cfg.Nodes[i].ID)

			ev := &simulation.ChaosEvent{
				ID:              uuid.New().String(),
				SimulationRunID: runID,
				NodeID:          cfg.Nodes[i].ID,
				EventType:       simulation.ChaosRegionDown,
				Severity:        1.0,
				DurationTicks:   100000,
				StartedAt:       engine.CurrentTick(),
				Active:          true,
			}
			h.Chaos.Inject(ev)
			injectedCount++
		}
	}

	// Count replicas (nodes of same type in other regions)
	replicaSet := make(map[string]bool)
	for _, id := range affectedNodeIDs {
		replicaID, _ := simulation.FindReplicaInOtherRegion(nodeMap, id)
		if replicaID != "" {
			replicaSet[replicaID] = true
		}
	}
	replicaCount := len(replicaSet)

	resp := FailoverTestResponse{
		SimulationRunID: runID,
		FailingRegion:   req.FailingRegion,
		AffectedNodes:   affectedNodeIDs,
		ReplicaCount:    replicaCount,
		InjectedEvents:  injectedCount,
		DNSDelayTicks:   simulation.DNSFailoverDelayTicks,
		Status:          "failover_initiated",
	}

	return c.Status(200).JSON(resp)
}

type GeoMetricsResponse struct {
	Regions        map[string]RegionMetrics `json:"regions"`
	InterRegionEdges []InterRegionEdge       `json:"interRegionEdges"`
}

type RegionMetrics struct {
	NodeCount        int      `json:"nodeCount"`
	TotalRPS         float64  `json:"totalRPS"`
	AvgLatencyMs     float64  `json:"avgLatencyMs"`
	AvgErrorRate     float64  `json:"avgErrorRate"`
	NodeIDs          []string `json:"nodeIds"`
	IsFailed         bool     `json:"isFailed"`
	FailedNodeIDs    []string `json:"failedNodeIds"`
}

type InterRegionEdge struct {
	SourceRegion string  `json:"sourceRegion"`
	TargetRegion string  `json:"targetRegion"`
	TotalRPS     float64 `json:"totalRPS"`
	AvgLatencyMs float64 `json:"avgLatencyMs"`
	EdgeCount    int     `json:"edgeCount"`
}

func (h *SimulationHandler) GetGeoMetrics(c *fiber.Ctx) error {
	runID := c.Params("id")
	if runID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "simulation run ID required"})
	}

	engine := h.FindEngine(runID)
	if engine == nil || !engine.IsRunning() {
		return c.Status(404).JSON(fiber.Map{"error": "simulation run not found or not running"})
	}

	cfg := engine.Config()
	nodeMap := engine.GetNodeMap()
	ticks := engine.Ticks()
	var latestTick *simulation.Tick
	if len(ticks) > 0 {
		latestTick = &ticks[len(ticks)-1]
	}

	// Build node-ID → region lookup from Config (available even before first tick)
	nodeRegion := make(map[string]string)
	nodesInRegion := make(map[string][]string)
	for i := range cfg.Nodes {
		r := cfg.Nodes[i].Region
		if r == "" {
			r = "us-east-1"
		}
		nodeRegion[cfg.Nodes[i].ID] = r
		nodesInRegion[r] = append(nodesInRegion[r], cfg.Nodes[i].ID)
	}

	// Aggregate metrics per region from latest tick
	regionRPS := make(map[string]float64)
	regionLatency := make(map[string]float64)
	regionErrorRate := make(map[string]float64)
	regionFailed := make(map[string][]string)
	regionCount := make(map[string]int)

	if latestTick != nil {
		for _, m := range latestTick.NodeMetrics {
			r, ok := nodeRegion[m.NodeID]
			if !ok {
				continue
			}
			regionRPS[r] += m.CurrentRPS
			regionLatency[r] += m.P99LatencyMs
			regionErrorRate[r] += m.ErrorRate
			regionCount[r]++
			if m.IsFailed {
				regionFailed[r] = append(regionFailed[r], m.NodeID)
			}
		}
	}

	regions := make(map[string]RegionMetrics)
	for region, ids := range nodesInRegion {
		count := regionCount[region]
		rps := regionRPS[region]
		lat := regionLatency[region]
		errRate := regionErrorRate[region]
		avgLat := 0.0
		if count > 0 {
			avgLat = lat / float64(count)
			errRate = errRate / float64(count)
		}
		failed := regionFailed[region]
		regions[region] = RegionMetrics{
			NodeCount:     len(ids),
			TotalRPS:      mathRound(rps, 2),
			AvgLatencyMs:  mathRound(avgLat, 2),
			AvgErrorRate:  mathRound(errRate, 4),
			NodeIDs:       ids,
			IsFailed:      len(failed) > 0,
			FailedNodeIDs: failed,
		}
	}

	// Compute cross-region edge traffic from node map
	type edgeKey struct{ src, tgt string }
	edgeRPS := make(map[edgeKey]float64)
	edgeLatency := make(map[edgeKey]float64)
	edgeCount := make(map[edgeKey]int)

	for _, n := range nodeMap {
		srcRegion := n.Region
		if srcRegion == "" {
			srcRegion = "us-east-1"
		}
		outs := engine.OutEdges(n.ID)
		for _, e := range outs {
			tgtNode, ok := nodeMap[e.Target]
			if !ok {
				continue
			}
			tgtRegion := tgtNode.Region
			if tgtRegion == "" {
				tgtRegion = "us-east-1"
			}
			if srcRegion == tgtRegion {
				continue
			}
			k := edgeKey{srcRegion, tgtRegion}
			edgeRPS[k] += e.ThroughputRPS
			edgeLatency[k] += e.LatencyMs
			edgeCount[k]++
		}
	}

	interRegionEdges := make([]InterRegionEdge, 0, len(edgeRPS))
	for k, rps := range edgeRPS {
		avgLat := 0.0
		if edgeCount[k] > 0 {
			avgLat = edgeLatency[k] / float64(edgeCount[k])
		}
		interRegionEdges = append(interRegionEdges, InterRegionEdge{
			SourceRegion: k.src,
			TargetRegion: k.tgt,
			TotalRPS:     mathRound(rps, 2),
			AvgLatencyMs: mathRound(avgLat, 2),
			EdgeCount:    edgeCount[k],
		})
	}

	if interRegionEdges == nil {
		interRegionEdges = []InterRegionEdge{}
	}

	return c.JSON(GeoMetricsResponse{
		Regions:          regions,
		InterRegionEdges: interRegionEdges,
	})
}

func mathRound(v float64, decimals int) float64 {
	pow := math.Pow(10, float64(decimals))
	return math.Round(v*pow) / pow
}

func (h *SimulationHandler) storeTick(runID string, tickNum int, tick *simulation.Tick) {
	data, _ := json.Marshal(tick)
	h.DB.Exec(
		`INSERT INTO simulation_ticks (run_id, tick_number, data, recorded_at)
		 VALUES ($1, $2, $3, $4)`,
		runID, tickNum, string(data), time.Now(),
	)
}

func (h *SimulationHandler) FindEngine(runID string) *simulation.Engine {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.engines[runID]
}

func (h *SimulationHandler) findEngineFromDB(runID string) *simulation.Engine {
	var configJSON string
	err := h.DB.QueryRow(`SELECT config FROM simulation_runs WHERE id = $1`, runID).Scan(&configJSON)
	if err != nil {
		return nil
	}

	var cfg simulation.Config
	if err := json.Unmarshal([]byte(configJSON), &cfg); err != nil {
		return nil
	}

	engine := simulation.NewEngine(&cfg)

	h.mu.Lock()
	h.engines[runID] = engine
	h.mu.Unlock()

	return engine
}

func FastHTTPUpgrade(c *fiber.Ctx, hub *ws.Hub, userID, projectID string) error {
	err := wsUpgrader.Upgrade(c.Context(), func(conn *websocket.Conn) {
		client := ws.NewClient(conn, hub, projectID, userID)
		hub.Register(client)
		go client.WritePump()
		client.ReadPump()
	})
	if err != nil {
		log.Printf("ws upgrade error: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "websocket upgrade failed"})
	}
	return nil
}
