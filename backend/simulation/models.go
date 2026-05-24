package simulation

import "time"

type NodeType string

const (
	NodeLoadBalancer      NodeType = "LoadBalancer"
	NodeAPIGateway        NodeType = "APIGateway"
	NodeWebServer         NodeType = "WebServer"
	NodeAppServer         NodeType = "AppServer"
	NodeMicroservice      NodeType = "Microservice"
	NodePostgreSQLDB      NodeType = "PostgreSQLDB"
	NodeMySQLDB           NodeType = "MySQLDB"
	NodeMongoDB           NodeType = "MongoDB"
	NodeRedis             NodeType = "Redis"
	NodeElasticsearch     NodeType = "Elasticsearch"
	NodeCDN               NodeType = "CDN"
	NodeDNS               NodeType = "DNS"
	NodeFirewall          NodeType = "Firewall"
	NodeVPC               NodeType = "VPC"
	NodeSubnet            NodeType = "Subnet"
	NodeMessageQueue      NodeType = "MessageQueue"
	NodeEventBus          NodeType = "EventBus"
	NodePubSub            NodeType = "PubSub"
	NodeContainerCluster  NodeType = "ContainerCluster"
	NodeServerless        NodeType = "ServerlessFunction"
	NodeBatchProcessor    NodeType = "BatchProcessor"
	NodeWorkerService     NodeType = "WorkerService"
	NodeExternalClient    NodeType = "ExternalClient"
	NodeThirdPartyAPI     NodeType = "ThirdPartyAPI"
	NodeMobileClient      NodeType = "MobileClient"
	NodeWebBrowser        NodeType = "WebBrowser"
)

func IsAsyncNodeType(nt NodeType) bool {
	switch nt {
	case NodeMessageQueue, NodeEventBus, NodePubSub:
		return true
	}
	return false
}

type DeploymentStrategy string

const (
	StrategyRolling  DeploymentStrategy = "rolling"
	StrategyBlueGreen DeploymentStrategy = "blue_green"
	StrategyCanary   DeploymentStrategy = "canary"
)

type DeploymentConfig struct {
	Strategy       DeploymentStrategy `json:"strategy"`
	CanaryPercent  float64            `json:"canaryPercent"`
	CanaryVersion  string             `json:"canaryVersion"`
	IsCanaryActive bool               `json:"isCanaryActive"`
}

type SecurityConfig struct {
	IsPublicFacing bool     `json:"isPublicFacing"`
	RequiresTLS    bool     `json:"requiresTLS"`
	AllowedInbound []string `json:"allowedInbound"`
	VpcID          string   `json:"vpcId"`
}

type AutoScaling struct {
	Enabled          bool    `json:"enabled"`
	MinInstances     int     `json:"minInstances"`
	MaxInstances     int     `json:"maxInstances"`
	TargetCPUPercent float64 `json:"targetCPUPercent"`
	TargetMemPercent float64 `json:"targetMemPercent"`
	CooldownTicks    int     `json:"cooldownTicks"`
	ScaleUpFactor    float64 `json:"scaleUpFactor"`
	ScaleDownFactor  float64 `json:"scaleDownFactor"`
}

type Node struct {
	ID                string           `json:"id"`
	NodeType          NodeType         `json:"nodeType"`
	Label             string           `json:"label"`
	MaxRPS            float64          `json:"maxRPS"`
	LatencyMs         float64          `json:"latencyMs"`
	ErrorRate         float64          `json:"errorRate"`
	Instances         int              `json:"instances"`
	IsFailed          bool             `json:"isFailed"`
	Deployment        DeploymentConfig `json:"deployment"`
	Security          SecurityConfig   `json:"security"`

	// Real-world internal node state config (from canvas)
	CacheHitRatio     float64     `json:"cacheHitRatio"`
	ConnectionPoolMax int         `json:"connectionPoolMax"`
	ColdStartMs       float64     `json:"coldStartMs"`
	DiskIOPSMax       float64     `json:"diskIOPSMax"`
	IsPrimaryDB       bool        `json:"isPrimaryDB"`
	AutoScaling       AutoScaling `json:"autoScaling"`
	ReplicationRole   string      `json:"replicationRole"`
	ReplicationLagMs  float64     `json:"replicationLagMs"`
	ComputeTier       string      `json:"computeTier"`

	// Runtime fields (reset per tick)
	CurrentRPS        float64 `json:"-"`
	QueueDepth        float64 `json:"-"`
	IsBottleneck      bool    `json:"-"`
	OverflowRPS       float64 `json:"-"`
	IncomingRPS       float64 `json:"-"`
	CPUPercent        float64 `json:"-"`
	MemoryPercent     float64 `json:"-"`
	ErrorCount        float64 `json:"-"`
	P99LatencyMs      float64 `json:"-"`
	CanaryRPS         float64 `json:"-"`

	// Internal runtime tracking (per-tick, not serialized)
	PrevActiveInstances int     `json:"-"`
	ActiveConnections   float64 `json:"-"`
	RetryCount          int     `json:"-"`
	DroppedRequests     float64 `json:"-"`
	LastScaleTick       int     `json:"-"`
	DesiredInstances    int     `json:"-"`
	ScalingEvent        string  `json:"-"`
	StaleReadCount      float64 `json:"-"`
	IsSplitBrain        bool    `json:"-"`
	DataInconsistency   float64 `json:"-"`
	SpotInterrupted     bool    `json:"-"`
}

type Edge struct {
	ID                string  `json:"id"`
	Source            string  `json:"source"`
	Target            string  `json:"target"`
	IsSync            bool    `json:"isSync"`
	TrafficPercent    float64 `json:"trafficPercent"`
	RequiresTLS       bool    `json:"requiresTLS"`
	Protocol          string  `json:"protocol"`
	PacketLossPercent float64 `json:"packetLossPercent"`
	JitterMs          float64 `json:"jitterMs"`
	ThroughputRPS     float64 `json:"-"`
	LatencyMs         float64 `json:"-"`
	// Runtime fields
	DroppedPackets    float64 `json:"-"`
}

type TrafficPattern string

const (
	TrafficSteady  TrafficPattern = "steady"
	TrafficRampUp  TrafficPattern = "ramp_up"
	TrafficSpike   TrafficPattern = "spike"
)

type Config struct {
	ProjectID        string         `json:"projectId"`
	Nodes            []Node         `json:"nodes"`
	Edges            []Edge         `json:"edges"`
	TargetRPS        float64        `json:"targetRPS"`
	DurationSeconds  int            `json:"durationSeconds"`
	SpeedMultiplier  float64        `json:"speedMultiplier"`
	Pattern          TrafficPattern `json:"pattern"`
	TickRateMs       int            `json:"tickRateMs"`
}

type NodeMetricsSnapshot struct {
	NodeID              string   `json:"nodeId"`
	NodeType            NodeType `json:"nodeType"`
	Label               string   `json:"label"`
	IncomingRPS         float64  `json:"incomingRPS"`
	CurrentRPS          float64  `json:"currentRPS"`
	CanaryRPS           float64  `json:"canaryRPS"`
	MaxRPS              float64  `json:"maxRPS"`
	Instances           int      `json:"instances"`
	LatencyMs           float64  `json:"latencyMs"`
	ErrorRate           float64  `json:"errorRate"`
	QueueDepth          float64  `json:"queueDepth"`
	IsBottleneck        bool     `json:"isBottleneck"`
	OverflowRPS         float64  `json:"overflowRPS"`
	CPUPercent          float64  `json:"cpuPercent"`
	MemoryPercent       float64  `json:"memoryPercent"`
	ErrorCount          float64  `json:"errorCount"`
	P99LatencyMs        float64  `json:"p99LatencyMs"`
	IsFailed            bool     `json:"isFailed"`
	IsAsync             bool     `json:"isAsync"`
	ActiveGroup         string   `json:"activeGroup,omitempty"`
	BlueGreenGroup      string   `json:"blueGreenGroup,omitempty"`
	// Network & retry fields
	RetryCount          int      `json:"retryCount"`
	DroppedRequests     float64  `json:"droppedRequests"`
	// Real-world internal state fields
	CacheHitRatio       float64  `json:"cacheHitRatio"`
	ConnectionPoolMax   int      `json:"connectionPoolMax"`
	ColdStartMs         float64  `json:"coldStartMs"`
	DiskIOPSMax         float64  `json:"diskIOPSMax"`
	IsPrimaryDB         bool     `json:"isPrimaryDB"`
	ActiveConnections   float64  `json:"activeConnections"`
	DesiredInstances    int      `json:"desiredInstances"`
	ScalingEvent        string   `json:"scalingEvent,omitempty"`
	ComputeTier         string   `json:"computeTier,omitempty"`
	ReplicationRole     string   `json:"replicationRole,omitempty"`
	ReplicationLagMs    float64  `json:"replicationLagMs,omitempty"`
	StaleReadCount      float64  `json:"staleReadCount,omitempty"`
	IsSplitBrain        bool     `json:"isSplitBrain,omitempty"`
	DataInconsistency   float64  `json:"dataInconsistency,omitempty"`
	SpotInterrupted     bool     `json:"spotInterrupted,omitempty"`
}

type Tick struct {
	TickNumber     int                   `json:"tickNumber"`
	Timestamp      time.Time             `json:"timestamp"`
	NodeMetrics    []NodeMetricsSnapshot `json:"nodeMetrics"`
	TotalRPS       float64               `json:"totalRPS"`
	GlobalErrorRate float64              `json:"globalErrorRate"`
	ActiveRequests float64               `json:"activeRequests"`
}

func (t *Tick) Clone() Tick {
	nm := make([]NodeMetricsSnapshot, len(t.NodeMetrics))
	copy(nm, t.NodeMetrics)
	return Tick{
		TickNumber:     t.TickNumber,
		Timestamp:      t.Timestamp,
		NodeMetrics:    nm,
		TotalRPS:       t.TotalRPS,
		GlobalErrorRate: t.GlobalErrorRate,
		ActiveRequests: t.ActiveRequests,
	}
}
