package config

import "systemdesign/simulation"

type NodeDefaults struct {
	NodeType     simulation.NodeType
	BaseLatency  float64
	DefaultRPS   float64
	DefaultMaxRPS float64
	CPUPercent   float64
	MemoryUtil   float64
	BaseReliability float64
	CostPerRPS   float64

	// AI/ML fields
	Dimensions          int
	IndexType           string
	TopK                int
	TokensPerSecond     float64
	VRAMGB              float64
	ModelSizeGB         float64
	SnapStartEnabled    bool
}

var DefaultConfigs = map[simulation.NodeType]NodeDefaults{
	// ── Web / Client ────────────────────────────────────────────
	simulation.NodeLoadBalancer: {
		BaseLatency: 2, DefaultRPS: 1000, DefaultMaxRPS: 10000,
		CPUPercent: 30, MemoryUtil: 40, BaseReliability: 0.9999, CostPerRPS: 0.002,
	},
	simulation.NodeWebServer: {
		BaseLatency: 10, DefaultRPS: 500, DefaultMaxRPS: 5000,
		CPUPercent: 50, MemoryUtil: 55, BaseReliability: 0.999, CostPerRPS: 0.001,
	},
	simulation.NodeAppServer: {
		BaseLatency: 20, DefaultRPS: 300, DefaultMaxRPS: 3000,
		CPUPercent: 60, MemoryUtil: 65, BaseReliability: 0.9995, CostPerRPS: 0.002,
	},
	simulation.NodeMicroservice: {
		BaseLatency: 15, DefaultRPS: 200, DefaultMaxRPS: 2000,
		CPUPercent: 55, MemoryUtil: 60, BaseReliability: 0.998, CostPerRPS: 0.003,
	},
	// ── Data / Storage ──────────────────────────────────────────
	simulation.NodePostgreSQLDB: {
		BaseLatency: 5, DefaultRPS: 1000, DefaultMaxRPS: 5000,
		CPUPercent: 40, MemoryUtil: 70, BaseReliability: 0.9999, CostPerRPS: 0.005,
	},
	simulation.NodeMySQLDB: {
		BaseLatency: 5, DefaultRPS: 1000, DefaultMaxRPS: 5000,
		CPUPercent: 40, MemoryUtil: 65, BaseReliability: 0.9995, CostPerRPS: 0.005,
	},
	simulation.NodeRedis: {
		BaseLatency: 1, DefaultRPS: 5000, DefaultMaxRPS: 50000,
		CPUPercent: 20, MemoryUtil: 50, BaseReliability: 0.9999, CostPerRPS: 0.001,
	},
	simulation.NodeMongoDB: {
		BaseLatency: 8, DefaultRPS: 800, DefaultMaxRPS: 4000,
		CPUPercent: 45, MemoryUtil: 65, BaseReliability: 0.9995, CostPerRPS: 0.004,
	},
	simulation.NodeCDN: {
		BaseLatency: 3, DefaultRPS: 10000, DefaultMaxRPS: 100000,
		CPUPercent: 10, MemoryUtil: 20, BaseReliability: 0.99999, CostPerRPS: 0.0005,
	},
	simulation.NodeElasticsearch: {
		BaseLatency: 10, DefaultRPS: 3000, DefaultMaxRPS: 10000,
		CPUPercent: 50, MemoryUtil: 75, BaseReliability: 0.9995, CostPerRPS: 0.004,
	},

	// ── Async / Streaming ───────────────────────────────────────
	simulation.NodeMessageQueue: {
		BaseLatency: 5, DefaultRPS: 2000, DefaultMaxRPS: 20000,
		CPUPercent: 25, MemoryUtil: 45, BaseReliability: 0.9995, CostPerRPS: 0.002,
	},
	simulation.NodeEventBus: {
		BaseLatency: 6, DefaultRPS: 1500, DefaultMaxRPS: 15000,
		CPUPercent: 20, MemoryUtil: 40, BaseReliability: 0.999, CostPerRPS: 0.002,
	},
	simulation.NodePubSub: {
		BaseLatency: 7, DefaultRPS: 2500, DefaultMaxRPS: 30000,
		CPUPercent: 25, MemoryUtil: 45, BaseReliability: 0.9995, CostPerRPS: 0.002,
	},

	// ── Container / Serverless ──────────────────────────────────
	simulation.NodeContainerCluster: {
		BaseLatency: 10, DefaultRPS: 500, DefaultMaxRPS: 5000,
		CPUPercent: 60, MemoryUtil: 65, BaseReliability: 0.999, CostPerRPS: 0.004,
	},
	simulation.NodeServerless: {
		BaseLatency: 15, DefaultRPS: 100, DefaultMaxRPS: 1000,
		CPUPercent: 40, MemoryUtil: 40, BaseReliability: 0.995, CostPerRPS: 0.008,
	},
	simulation.NodeBatchProcessor: {
		BaseLatency: 50, DefaultRPS: 50, DefaultMaxRPS: 500,
		CPUPercent: 80, MemoryUtil: 70, BaseReliability: 0.99, CostPerRPS: 0.01,
	},
	simulation.NodeWorkerService: {
		BaseLatency: 12, DefaultRPS: 300, DefaultMaxRPS: 3000,
		CPUPercent: 50, MemoryUtil: 55, BaseReliability: 0.998, CostPerRPS: 0.002,
	},

	// ── External / API ──────────────────────────────────────────
	simulation.NodeExternalClient: {
		BaseLatency: 30, DefaultRPS: 100, DefaultMaxRPS: 1000,
		CPUPercent: 30, MemoryUtil: 30, BaseReliability: 0.95, CostPerRPS: 0.005,
	},
	simulation.NodeThirdPartyAPI: {
		BaseLatency: 100, DefaultRPS: 50, DefaultMaxRPS: 500,
		CPUPercent: 10, MemoryUtil: 10, BaseReliability: 0.95, CostPerRPS: 0.02,
	},
	simulation.NodeMobileClient: {
		BaseLatency: 50, DefaultRPS: 200, DefaultMaxRPS: 5000,
		CPUPercent: 20, MemoryUtil: 30, BaseReliability: 0.90, CostPerRPS: 0.001,
	},
	simulation.NodeWebBrowser: {
		BaseLatency: 20, DefaultRPS: 300, DefaultMaxRPS: 10000,
		CPUPercent: 15, MemoryUtil: 25, BaseReliability: 0.92, CostPerRPS: 0.0005,
	},

	// ── AI/ML & Modern Compute ──────────────────────────────────
	simulation.NodeVectorDB: {
		BaseLatency: 10, DefaultRPS: 200, DefaultMaxRPS: 2000,
		CPUPercent: 45, MemoryUtil: 60, BaseReliability: 0.999,
		CostPerRPS: 0.006, Dimensions: 1536, IndexType: "hnsw", TopK: 10,
	},
	simulation.NodeLLMNode: {
		BaseLatency: 50, DefaultRPS: 50, DefaultMaxRPS: 500,
		CPUPercent: 70, MemoryUtil: 75, BaseReliability: 0.995,
		CostPerRPS: 0.05, TokensPerSecond: 1000,
	},
	simulation.NodeGPUCluster: {
		BaseLatency: 5, DefaultRPS: 100, DefaultMaxRPS: 1000,
		CPUPercent: 90, MemoryUtil: 80, BaseReliability: 0.999,
		CostPerRPS: 0.10, VRAMGB: 80, ModelSizeGB: 70,
	},
	simulation.NodeEdgeCompute: {
		BaseLatency: 2, DefaultRPS: 300, DefaultMaxRPS: 3000,
		CPUPercent: 35, MemoryUtil: 40, BaseReliability: 0.995,
		CostPerRPS: 0.003,
	},
	simulation.NodeServerlessV2: {
		BaseLatency: 10, DefaultRPS: 200, DefaultMaxRPS: 2000,
		CPUPercent: 40, MemoryUtil: 40, BaseReliability: 0.998,
		CostPerRPS: 0.006, SnapStartEnabled: false,
	},
}

func GetDefaults(nt simulation.NodeType) NodeDefaults {
	if d, ok := DefaultConfigs[nt]; ok {
		return d
	}
	return NodeDefaults{
		BaseLatency: 20, DefaultRPS: 100, DefaultMaxRPS: 1000,
		CPUPercent: 50, MemoryUtil: 50, BaseReliability: 0.99, CostPerRPS: 0.005,
	}
}
