package finops

import (
	"encoding/json"
	"fmt"
	"math"
	"time"
)

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
	// Modern workload types
	NodeLLMNode          NodeType = "LLMNode"
	NodeGPUCluster       NodeType = "GPUCluster"
	NodeEdgeCompute      NodeType = "EdgeCompute"
	NodeServerlessV2     NodeType = "ServerlessV2"
)

// AWS-style pricing constants
const (
	// Compute tiers
	ComputeTierOnDemand  = "on_demand"
	ComputeTierReserved  = "reserved"
	ComputeTierSpot      = "spot"

	// Base compute prices (t3.medium equivalent)
	BaseComputeMonthly = 30.37

	// Data transfer
	InterRegionEgressCost = 0.02   // $/GB between regions
	InternetEgressCost    = 0.09   // $/GB for internet egress (first 10TB)

	// Per-request pricing (DynamoDB/Aurora Serverless style)
	WriteRequestUnitCost = 1.25    // per million write units
	ReadRequestUnitCost  = 0.25    // per million read units

	// Tiered storage (S3)
	StorageTier1Cost = 0.023      // $/GB first 50TB
	StorageTier2Cost = 0.022      // $/GB next 450TB
	StorageTier3Cost = 0.021      // $/GB over 500TB
	StorageTier1Cap  = 50.0 * 1024 // 50TB in GB
	StorageTier2Cap  = 500.0 * 1024 // 500TB in GB

	// Default response sizes (KB)
	RespSizeAppServer = 50.0
	RespSizeDB        = 10.0
	RespSizeCDN       = 500.0
	RespSizeDefault   = 10.0

	// LLM token pricing ($ per 1k tokens)
	LLMInputTokenPrice  = 0.03  // per 1k input tokens
	LLMOutputTokenPrice = 0.06  // per 1k output tokens
	LLMTokensPerRPSUnit = 1000  // estimated tokens per request

	// GPU compute (AWS P4d)
	GPUPricePerHour = 32.77

	// Edge compute (Cloudflare Workers)
	EdgeRequestPrice     = 0.50  // per million requests
	EdgeEgressPricePerGB = 0.08

	// ServerlessV2 (Lambda SnapStart)
	ServerlessV2PricePerMillion = 0.20 // same as Lambda

	// Multi-cloud per-instance prices (hourly)
	GCPAppServerHourly = 0.20   // GCE n2-standard-4
	AzureAppServerHourly = 0.192 // D4s v3
)

type PricingRule struct {
	NodeType    NodeType
	BaseMonthly float64
	PerInstance float64
	PerUnitDesc string
	UnitPrice   float64
}

var pricingRules = map[NodeType]PricingRule{
	NodeLoadBalancer:     {BaseMonthly: 16.43, PerInstance: 0, PerUnitDesc: "", UnitPrice: 0},
	NodeAPIGateway:       {BaseMonthly: 3.50, PerInstance: 0, PerUnitDesc: "per 1M requests", UnitPrice: 3.50},
	NodeWebServer:        {BaseMonthly: 0, PerInstance: BaseComputeMonthly, PerUnitDesc: "per instance (t3.medium)", UnitPrice: 0},
	NodeAppServer:        {BaseMonthly: 0, PerInstance: BaseComputeMonthly, PerUnitDesc: "per instance (t3.medium)", UnitPrice: 0},
	NodeMicroservice:     {BaseMonthly: 0, PerInstance: BaseComputeMonthly, PerUnitDesc: "per instance (t3.medium)", UnitPrice: 0},
	NodePostgreSQLDB:     {BaseMonthly: 50.00, PerInstance: 0, PerUnitDesc: "per instance (db.t3.small)", UnitPrice: 0},
	NodeMySQLDB:          {BaseMonthly: 50.00, PerInstance: 0, PerUnitDesc: "per instance (db.t3.small)", UnitPrice: 0},
	NodeMongoDB:          {BaseMonthly: 60.00, PerInstance: 0, PerUnitDesc: "per instance (M10)", UnitPrice: 0},
	NodeRedis:            {BaseMonthly: 15.00, PerInstance: 0, PerUnitDesc: "per instance (cache.t3.micro)", UnitPrice: 0},
	NodeElasticsearch:    {BaseMonthly: 45.00, PerInstance: 0, PerUnitDesc: "per instance (t3.small.es)", UnitPrice: 0},
	NodeCDN:              {BaseMonthly: 0, PerInstance: 0, PerUnitDesc: "per GB transfer", UnitPrice: 0.085},
	NodeDNS:              {BaseMonthly: 0.50, PerInstance: 0, PerUnitDesc: "per 1M queries", UnitPrice: 0.40},
	NodeFirewall:         {BaseMonthly: 25.00, PerInstance: 0, PerUnitDesc: "", UnitPrice: 0},
	NodeVPC:              {BaseMonthly: 0, PerInstance: 0, PerUnitDesc: "", UnitPrice: 0},
	NodeSubnet:           {BaseMonthly: 0, PerInstance: 0, PerUnitDesc: "", UnitPrice: 0},
	NodeMessageQueue:     {BaseMonthly: 0.40, PerInstance: 0, PerUnitDesc: "per 1M requests", UnitPrice: 0.40},
	NodeEventBus:         {BaseMonthly: 1.00, PerInstance: 0, PerUnitDesc: "per 1M events", UnitPrice: 1.00},
	NodePubSub:           {BaseMonthly: 10.00, PerInstance: 0, PerUnitDesc: "", UnitPrice: 0},
	NodeContainerCluster: {BaseMonthly: 73.00, PerInstance: 0, PerUnitDesc: "per cluster (EKS)", UnitPrice: 0},
	NodeServerless:       {BaseMonthly: 0, PerInstance: 0, PerUnitDesc: "per 1M invocations", UnitPrice: 0.20},
	NodeBatchProcessor:   {BaseMonthly: 0, PerInstance: BaseComputeMonthly, PerUnitDesc: "per compute instance", UnitPrice: 0},
	NodeWorkerService:    {BaseMonthly: 0, PerInstance: BaseComputeMonthly, PerUnitDesc: "per instance (t3.medium)", UnitPrice: 0},
	// Modern workloads
	NodeLLMNode:          {BaseMonthly: 0, PerInstance: 0, PerUnitDesc: "per 1k tokens", UnitPrice: 0},
	NodeGPUCluster:       {BaseMonthly: 0, PerInstance: GPUPricePerHour, PerUnitDesc: "per GPU instance (P4d)", UnitPrice: 0},
	NodeEdgeCompute:      {BaseMonthly: 0, PerInstance: 0, PerUnitDesc: "per million requests", UnitPrice: EdgeRequestPrice},
	NodeServerlessV2:     {BaseMonthly: 0, PerInstance: 0, PerUnitDesc: "per 1M invocations", UnitPrice: ServerlessV2PricePerMillion},
}

type categoryInfo struct {
	Name  string
	Types []NodeType
}

var categories = []categoryInfo{
	{Name: "Compute", Types: []NodeType{NodeWebServer, NodeAppServer, NodeMicroservice, NodeWorkerService, NodeBatchProcessor, NodeServerless}},
	{Name: "Networking", Types: []NodeType{NodeLoadBalancer, NodeAPIGateway, NodeCDN, NodeDNS, NodeFirewall, NodeVPC, NodeSubnet}},
	{Name: "Data & Storage", Types: []NodeType{NodePostgreSQLDB, NodeMySQLDB, NodeMongoDB, NodeRedis, NodeElasticsearch}},
	{Name: "Data Transfer", Types: []NodeType{}},
	{Name: "Request-Based", Types: []NodeType{}},
	{Name: "Tiered Storage", Types: []NodeType{}},
	{Name: "Messaging & Events", Types: []NodeType{NodeMessageQueue, NodeEventBus, NodePubSub}},
	{Name: "Orchestration", Types: []NodeType{NodeContainerCluster}},
	{Name: "AI / GPU", Types: []NodeType{NodeLLMNode, NodeGPUCluster}},
	{Name: "Edge & Serverless", Types: []NodeType{NodeEdgeCompute, NodeServerlessV2}},
	{Name: "External", Types: []NodeType{NodeExternalClient, NodeThirdPartyAPI, NodeMobileClient, NodeWebBrowser}},
}

type InfraResource struct {
	CloudProvider string `json:"cloudProvider,omitempty"`
}

type canvasNode struct {
	ID   string `json:"id"`
	Data struct {
		NodeType NodeType                `json:"nodeType"`
		Label    string                  `json:"label"`
		Config   map[string]any          `json:"config"`
		Metrics  map[string]any          `json:"metrics"`
		Resource InfraResource           `json:"resource,omitempty"`
	} `json:"data"`
}

type canvasEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Data   struct {
		Routing map[string]any `json:"routing"`
	} `json:"data"`
}

type CostLineItem struct {
	Service     string  `json:"service"`
	Description string  `json:"description"`
	UnitPrice   float64 `json:"unitPrice"`
	Quantity    int     `json:"quantity"`
	MonthlyCost float64 `json:"monthlyCost"`
}

type CostCategory struct {
	Category string        `json:"category"`
	Items    []CostLineItem `json:"items"`
	Subtotal float64       `json:"subtotal"`
}

type CostEstimate struct {
	UserTier         string         `json:"userTier"`
	MonthlyUsers     int            `json:"monthlyUsers"`
	Multiplier       float64        `json:"multiplier"`
	TotalMonthlyCost float64        `json:"totalMonthlyCost"`
	Breakdown        []CostCategory `json:"breakdown"`
	DataEgressTotal  float64        `json:"dataEgressTotal,omitempty"`
}

type Recommendation struct {
	Title           string  `json:"title"`
	Description     string  `json:"description"`
	PotentialSavings float64 `json:"potentialSavings"`
	AnnualSavings   float64 `json:"annualSavings"`
	Effort          string  `json:"effort"`
}

type CostReport struct {
	ProjectID          string              `json:"projectId"`
	MonthlyUsers       int                 `json:"monthlyUsers"`
	CurrentEstimate    CostEstimate   `json:"currentEstimate"`
	ScalingProjections []CostEstimate `json:"scalingProjections"`
	Recommendations   []Recommendation    `json:"recommendations"`
	GeneratedAt        string              `json:"generatedAt"`
}

// Compute tier multipliers
var computeTierMultipliers = map[string]float64{
	ComputeTierOnDemand: 1.0,
	ComputeTierReserved: 0.6,
	ComputeTierSpot:     0.3,
}

func getResponseSizeKB(nt NodeType) float64 {
	switch nt {
	case NodeAppServer, NodeMicroservice, NodeWebServer:
		return RespSizeAppServer
	case NodeCDN:
		return RespSizeCDN
	case NodePostgreSQLDB, NodeMySQLDB, NodeMongoDB, NodeRedis, NodeElasticsearch:
		return RespSizeDB
	default:
		return RespSizeDefault
	}
}

func getInstances(cfg map[string]any) int {
	if v, ok := cfg["instances"]; ok {
		if f, ok := v.(float64); ok {
			return int(f)
		}
	}
	return 1
}

func getRegion(cfg map[string]any) string {
	if v, ok := cfg["region"]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return "us-east-1"
}

func getComputeTier(cfg map[string]any) string {
	if v, ok := cfg["computeTier"]; ok {
		if s, ok := v.(string); ok {
			if s == ComputeTierOnDemand || s == ComputeTierReserved || s == ComputeTierSpot {
				return s
			}
		}
	}
	return ComputeTierOnDemand
}

func isServerless(nt NodeType) bool {
	return nt == NodeServerless || nt == NodeAPIGateway || nt == NodeMessageQueue || nt == NodeEventBus
}

func isExternalClient(nt NodeType) bool {
	return nt == NodeExternalClient || nt == NodeThirdPartyAPI || nt == NodeMobileClient || nt == NodeWebBrowser
}

func isDatabaseNode(nt NodeType) bool {
	switch nt {
	case NodePostgreSQLDB, NodeMySQLDB, NodeMongoDB, NodeRedis, NodeElasticsearch:
		return true
	}
	return false
}

func estimateMonthlyUsers(node NodeType, cfg map[string]any) int {
	instances := getInstances(cfg)
	base := instances * 10000
	switch node {
	case NodeLoadBalancer:
		return instances * 50000
	case NodeWebServer, NodeAppServer, NodeMicroservice, NodeWorkerService:
		return instances * 10000
	case NodePostgreSQLDB, NodeMySQLDB, NodeMongoDB:
		return instances * 50000
	case NodeRedis:
		return instances * 100000
	default:
		return base
	}
}

type costResult struct {
	items       []CostLineItem
	total       float64
	totalAnnual float64
}

func calculateEdgeEgress(sourceRegion, targetRegion string, targetNodeType NodeType, edgeTrafficPercent float64, sourceMaxRPS float64, sourceType NodeType) (CostLineItem, float64) {
	// Estimate RPS through this edge based on source node capacity
	estimatedRPS := sourceMaxRPS * (edgeTrafficPercent / 100.0)

	// Calculate GB per month: (RPS * avgResponseSizeKB * 86400 * 30) / (1024*1024)
	respSizeKB := getResponseSizeKB(sourceType)
	gbPerMonth := (estimatedRPS * respSizeKB * 86400.0 * 30.0) / (1024.0 * 1024.0)

	var costPerGB float64
	var transferType string

	if isExternalClient(targetNodeType) {
		costPerGB = InternetEgressCost
		transferType = "Internet egress"
	} else if sourceRegion != targetRegion {
		costPerGB = InterRegionEgressCost
		transferType = "Inter-region"
	} else {
		costPerGB = 0
		transferType = "Same-region"
	}

	monthlyCost := gbPerMonth * costPerGB
	desc := fmt.Sprintf("%s — %.1f GB/mo (%s)", transferType, gbPerMonth, sourceRegion)

	if transferType == "Internet egress" {
		desc = fmt.Sprintf("%s — %.1f GB/mo to internet", transferType, gbPerMonth)
	}

	item := CostLineItem{
		Service:     transferType,
		Description: desc,
		UnitPrice:   costPerGB,
		Quantity:    int(math.Ceil(gbPerMonth)),
		MonthlyCost: mathRound(monthlyCost, 2),
	}

	return item, monthlyCost
}

func calculatePerRequestCost(nt NodeType, estimatedRPS float64) ([]CostLineItem, float64) {
	if nt != NodeServerless && !isDatabaseNode(nt) {
		return nil, 0
	}

	// Monthly request count
	totalMonthlyRequests := estimatedRPS * 86400.0 * 30.0
	millionRequests := totalMonthlyRequests / 1_000_000.0

	// Assume 70/30 read/write split
	readUnits := millionRequests * 0.7
	writeUnits := millionRequests * 0.3

	writeCost := writeUnits * WriteRequestUnitCost
	readCost := readUnits * ReadRequestUnitCost

	items := []CostLineItem{
		{
			Service:     "Write Requests",
			Description: fmt.Sprintf("Write — %.1fM units × $%.2f/M", writeUnits, WriteRequestUnitCost),
			UnitPrice:   WriteRequestUnitCost,
			Quantity:    int(math.Ceil(writeUnits)),
			MonthlyCost: mathRound(writeCost, 2),
		},
		{
			Service:     "Read Requests",
			Description: fmt.Sprintf("Read — %.1fM units × $%.2f/M", readUnits, ReadRequestUnitCost),
			UnitPrice:   ReadRequestUnitCost,
			Quantity:    int(math.Ceil(readUnits)),
			MonthlyCost: mathRound(readCost, 2),
		},
	}

	return items, writeCost + readCost
}

func calculateStorageCost(storageGB float64) ([]CostLineItem, float64) {
	if storageGB <= 0 {
		return nil, 0
	}

	tier1 := math.Min(storageGB, StorageTier1Cap)
	tier2 := math.Max(0, math.Min(storageGB-StorageTier1Cap, StorageTier2Cap-StorageTier1Cap))
	tier3 := math.Max(0, storageGB-StorageTier2Cap)

	tier1Cost := tier1 * StorageTier1Cost
	tier2Cost := tier2 * StorageTier2Cost
	tier3Cost := tier3 * StorageTier3Cost

	total := tier1Cost + tier2Cost + tier3Cost
	items := []CostLineItem{
		{
			Service:     "S3 Standard",
			Description: fmt.Sprintf("First 50TB — %.0f GB × $%.3f", tier1, StorageTier1Cost),
			UnitPrice:   StorageTier1Cost,
			Quantity:    int(math.Ceil(tier1)),
			MonthlyCost: mathRound(tier1Cost, 2),
		},
	}
	if tier2 > 0 {
		items = append(items, CostLineItem{
			Service:     "S3 Standard",
			Description: fmt.Sprintf("Next 450TB — %.0f GB × $%.3f", tier2, StorageTier2Cost),
			UnitPrice:   StorageTier2Cost,
			Quantity:    int(math.Ceil(tier2)),
			MonthlyCost: mathRound(tier2Cost, 2),
		})
	}
	if tier3 > 0 {
		items = append(items, CostLineItem{
			Service:     "S3 Standard",
			Description: fmt.Sprintf("Over 500TB — %.0f GB × $%.3f", tier3, StorageTier3Cost),
			UnitPrice:   StorageTier3Cost,
			Quantity:    int(math.Ceil(tier3)),
			MonthlyCost: mathRound(tier3Cost, 2),
		})
	}

	return items, total
}

func estimateStorageFromNode(nt NodeType, instances int) float64 {
	switch nt {
	case NodePostgreSQLDB, NodeMySQLDB:
		return float64(instances) * 100.0 // 100GB per instance
	case NodeMongoDB:
		return float64(instances) * 200.0
	case NodeRedis:
		return float64(instances) * 20.0
	case NodeElasticsearch:
		return float64(instances) * 150.0
	case NodeCDN:
		return float64(instances) * 500.0
	case NodeWebServer, NodeAppServer, NodeMicroservice:
		return float64(instances) * 50.0
	default:
		return 0
	}
}

func getCloudProvider(cfg map[string]any, resource InfraResource, defaultProvider string) string {
	if resource.CloudProvider != "" {
		return resource.CloudProvider
	}
	if v, ok := cfg["cloudProvider"]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	if defaultProvider != "" {
		return defaultProvider
	}
	return "aws"
}

func calculateNodeCost(nt NodeType, label string, cfg map[string]any, monthlyUsers int, multiplier float64, cloudProvider string, rps float64) costResult {
	rule, ok := pricingRules[nt]
	if !ok {
		return costResult{}
	}

	instances := getInstances(cfg)
	scaledInstances := int(math.Ceil(float64(instances) * multiplier))
	if scaledInstances < 1 {
		scaledInstances = 1
	}

	tier := getComputeTier(cfg)
	tierMult := computeTierMultipliers[tier]

	items := make([]CostLineItem, 0)
	total := 0.0

	base := rule.BaseMonthly
	if base > 0 {
		desc := fmt.Sprintf("%s — base cost", label)
		if rule.PerUnitDesc != "" {
			desc = fmt.Sprintf("%s — base (%s)", label, rule.PerUnitDesc)
		}
		items = append(items, CostLineItem{
			Service:     label,
			Description: desc,
			UnitPrice:   base,
			Quantity:    1,
			MonthlyCost: mathRound(base, 2),
		})
		total += base
	}

	if rule.PerInstance > 0 {
		adjustedPrice := rule.PerInstance * tierMult
		effectivePrice := adjustedPrice
		// Multi-cloud pricing: override base price for AppServer
		if nt == NodeAppServer {
			if cloudProvider == "gcp" {
				effectivePrice = GCPAppServerHourly * 730 * tierMult // 730 hours/month
			} else if cloudProvider == "azure" {
				effectivePrice = AzureAppServerHourly * 730 * tierMult // 730 hours/month
			}
		}
		// GPUCluster price is per-hour, convert to monthly (730 hours)
		if nt == NodeGPUCluster {
			effectivePrice = GPUPricePerHour * 730 * tierMult
		}
		cost := effectivePrice * float64(scaledInstances)
		tierLabel := ""
		switch tier {
		case ComputeTierReserved:
			tierLabel = " [Reserved 40% off]"
		case ComputeTierSpot:
			tierLabel = " [Spot 70% off]"
		}
		items = append(items, CostLineItem{
			Service:     label,
			Description: fmt.Sprintf("%s — %d instance(s) (%s)%s", label, scaledInstances, rule.PerUnitDesc, tierLabel),
			UnitPrice:   mathRound(effectivePrice, 2),
			Quantity:    scaledInstances,
			MonthlyCost: mathRound(cost, 2),
		})
		total += cost
	}

	if isServerless(nt) && rule.UnitPrice > 0 {
		estimatedUnits := float64(monthlyUsers) / 1_000_000 * multiplier
		if estimatedUnits < 0.1 {
			estimatedUnits = 0.1
		}
		cost := rule.UnitPrice * estimatedUnits
		unitLabel := rule.PerUnitDesc
		items = append(items, CostLineItem{
			Service:     label,
			Description: fmt.Sprintf("%s — %.1f units (%s)", label, estimatedUnits, unitLabel),
			UnitPrice:   rule.UnitPrice,
			Quantity:    int(math.Ceil(estimatedUnits)),
			MonthlyCost: mathRound(cost, 2),
		})
		total += cost
	}

	if nt == NodeCDN && rule.UnitPrice > 0 {
		gbTransfer := float64(monthlyUsers) * 0.15 * multiplier
		cost := rule.UnitPrice * gbTransfer
		items = append(items, CostLineItem{
			Service:     label,
			Description: fmt.Sprintf("%s — %.0f GB transfer", label, gbTransfer),
			UnitPrice:   rule.UnitPrice,
			Quantity:    int(math.Ceil(gbTransfer)),
			MonthlyCost: mathRound(cost, 2),
		})
		total += cost
	}

	if nt == NodeDNS && rule.UnitPrice > 0 {
		queries := float64(monthlyUsers) * 10 * multiplier
		queryUnits := queries / 1_000_000
		cost := rule.UnitPrice * queryUnits
		items = append(items, CostLineItem{
			Service:     label,
			Description: fmt.Sprintf("%s — %.0fM queries", label, queryUnits),
			UnitPrice:   rule.UnitPrice,
			Quantity:    int(math.Ceil(queryUnits)),
			MonthlyCost: mathRound(cost, 2),
		})
		total += cost
	}

	// LLM token cost: based on RPS
	if nt == NodeLLMNode && rps > 0 {
		scaledRPS := rps * multiplier
		requestsPerMonth := scaledRPS * 86400.0 * 30.0
		totalTokens := requestsPerMonth * LLMTokensPerRPSUnit
		inputTokensK := (totalTokens * 0.6) / 1000.0  // ~60% input
		outputTokensK := (totalTokens * 0.4) / 1000.0  // ~40% output
		inputCost := inputTokensK * LLMInputTokenPrice
		outputCost := outputTokensK * LLMOutputTokenPrice
		tokenCost := inputCost + outputCost
		if tokenCost > 0 {
			items = append(items,
				CostLineItem{
					Service:     label + " (Input Tokens)",
					Description: fmt.Sprintf("%s — %.0fK input tokens × $%.4f/K", label, inputTokensK, LLMInputTokenPrice),
					UnitPrice:   LLMInputTokenPrice,
					Quantity:    int(math.Ceil(inputTokensK)),
					MonthlyCost: mathRound(inputCost, 2),
				},
				CostLineItem{
					Service:     label + " (Output Tokens)",
					Description: fmt.Sprintf("%s — %.0fK output tokens × $%.4f/K", label, outputTokensK, LLMOutputTokenPrice),
					UnitPrice:   LLMOutputTokenPrice,
					Quantity:    int(math.Ceil(outputTokensK)),
					MonthlyCost: mathRound(outputCost, 2),
				},
			)
			total += tokenCost
		}
	}

	// Edge compute: request-based pricing (already in UnitPrice) + egress
	if nt == NodeEdgeCompute && rule.UnitPrice > 0 {
		estimatedUnits := float64(monthlyUsers) / 1_000_000 * multiplier
		if estimatedUnits < 0.1 {
			estimatedUnits = 0.1
		}
		reqCost := rule.UnitPrice * estimatedUnits
		items = append(items, CostLineItem{
			Service:     label,
			Description: fmt.Sprintf("%s — %.1fM requests ($%.2f/M)", label, estimatedUnits, EdgeRequestPrice),
			UnitPrice:   EdgeRequestPrice,
			Quantity:    int(math.Ceil(estimatedUnits)),
			MonthlyCost: mathRound(reqCost, 2),
		})
		total += reqCost

		// Edge egress
		edgeRespSizeKB := RespSizeDefault
		gbPerMonth := (rps * edgeRespSizeKB * 86400.0 * 30.0) / (1024.0 * 1024.0)
		if gbPerMonth > 0 {
			egressCost := gbPerMonth * EdgeEgressPricePerGB
			items = append(items, CostLineItem{
				Service:     label + " (Egress)",
				Description: fmt.Sprintf("%s — %.1f GB egress × $%.2f/GB", label, gbPerMonth, EdgeEgressPricePerGB),
				UnitPrice:   EdgeEgressPricePerGB,
				Quantity:    int(math.Ceil(gbPerMonth)),
				MonthlyCost: mathRound(egressCost, 2),
			})
			total += egressCost
		}
	}

	// ServerlessV2: same per-invocation as Lambda but with minimum 10s billing
	if nt == NodeServerlessV2 && rule.UnitPrice > 0 {
		estimatedUnits := float64(monthlyUsers) / 1_000_000 * multiplier
		if estimatedUnits < 0.1 {
			estimatedUnits = 0.1
		}
		// Min 10s billing ~ 2x multiplier for typical fast functions
		minDurationMult := 2.0
		adjusted := estimatedUnits * minDurationMult
		cost := rule.UnitPrice * adjusted
		items = append(items, CostLineItem{
			Service:     label,
			Description: fmt.Sprintf("%s — %.1fM invocations × $%.2f/M (min 10s billing)", label, adjusted, rule.UnitPrice),
			UnitPrice:   rule.UnitPrice,
			Quantity:    int(math.Ceil(adjusted)),
			MonthlyCost: mathRound(cost, 2),
		})
		total += cost
	}

	return costResult{items: items, total: total}
}

type userTier struct {
	label      string
	users      int
	multiplier float64
}

var userTiers = []userTier{
	{label: "1k users (prototype)", users: 1_000, multiplier: 1},
	{label: "10k users (launch)", users: 10_000, multiplier: 3},
	{label: "100k users (growth)", users: 100_000, multiplier: 10},
	{label: "1M users (scale)", users: 1_000_000, multiplier: 30},
}

type nodeInfo struct {
	nodeType      NodeType
	label         string
	config        map[string]any
	cloudProvider string
	rps           float64
}

type edgeInfo struct {
	source string
	target string
	data   struct {
		routing map[string]any
	}
}

func Calculate(canvasData []byte, projectID string, monthlyUsers int, defaultProvider string) (*CostReport, error) {
	var canvas struct {
		Nodes []canvasNode `json:"nodes"`
		Edges []canvasEdge `json:"edges"`
	}
	if err := json.Unmarshal(canvasData, &canvas); err != nil {
		return nil, fmt.Errorf("failed to parse canvas data: %w", err)
	}

	// Build node lookup by ID
	nodeLookup := make(map[string]canvasNode)
	nodes := make([]nodeInfo, 0, len(canvas.Nodes))
	for _, n := range canvas.Nodes {
		nodeLookup[n.ID] = n
		nt := n.Data.NodeType
		if _, ok := pricingRules[nt]; !ok {
			continue
		}
		if isExternalClient(nt) {
			continue
		}
		cp := getCloudProvider(n.Data.Config, n.Data.Resource, defaultProvider)
		rps := 1000.0
		if v, ok := n.Data.Config["maxRPS"]; ok {
			if f, ok := v.(float64); ok {
				rps = f
			}
		}
		nodes = append(nodes, nodeInfo{nodeType: nt, label: n.Data.Label, config: n.Data.Config, cloudProvider: cp, rps: rps})
	}

	if len(nodes) == 0 {
		return nil, fmt.Errorf("no billable resources found in the canvas")
	}

	// Collect edges for data transfer computation
	edgeList := make([]edgeInfo, 0, len(canvas.Edges))
	for _, e := range canvas.Edges {
		routing := make(map[string]any)
		if e.Data.Routing != nil {
			routing = e.Data.Routing
		}
		edgeList = append(edgeList, edgeInfo{source: e.Source, target: e.Target, data: struct{ routing map[string]any }{routing: routing}})
	}

	projections := make([]CostEstimate, 0, len(userTiers))

	for _, tier := range userTiers {
		categoryMap := make(map[string][]CostLineItem)
		catTotals := make(map[string]float64)
		totalCost := 0.0
		totalEgress := 0.0

		for _, info := range nodes {
			result := calculateNodeCost(info.nodeType, info.label, info.config, tier.users, tier.multiplier, info.cloudProvider, info.rps)
			catName := categoryForType(info.nodeType)
			categoryMap[catName] = append(categoryMap[catName], result.items...)
			catTotals[catName] += result.total
			totalCost += result.total

			// Per-request pricing for Serverless/DB nodes
			maxRPS := 1000.0
			if v, ok := info.config["maxRPS"]; ok {
				if f, ok := v.(float64); ok {
					maxRPS = f
				}
			}
			scaledRPS := maxRPS * tier.multiplier
			reqItems, reqCost := calculatePerRequestCost(info.nodeType, scaledRPS)
			if reqCost > 0 {
				categoryMap["Request-Based"] = append(categoryMap["Request-Based"], reqItems...)
				catTotals["Request-Based"] += reqCost
				totalCost += reqCost
			}

			// Tiered storage cost
			instances := getInstances(info.config)
			storageGB := estimateStorageFromNode(info.nodeType, instances)
			if storageGB > 0 {
				storageItems, storageCost := calculateStorageCost(storageGB)
				categoryMap["Tiered Storage"] = append(categoryMap["Tiered Storage"], storageItems...)
				catTotals["Tiered Storage"] += storageCost
				totalCost += storageCost
			}
		}

		// Data egress from edges
		egressItems := make([]CostLineItem, 0)
		for _, ei := range edgeList {
			srcNode, srcOK := nodeLookup[ei.source]
			tgtNode, tgtOK := nodeLookup[ei.target]
			if !srcOK || !tgtOK {
				continue
			}

			srcRegion := getRegion(srcNode.Data.Config)
			tgtRegion := getRegion(tgtNode.Data.Config)
			tgtNodeType := tgtNode.Data.NodeType

			// Get source node maxRPS and traffic percent
			srcMaxRPS := 1000.0
			if v, ok := srcNode.Data.Config["maxRPS"]; ok {
				if f, ok := v.(float64); ok {
					srcMaxRPS = f
				}
			}

			trafficPercent := 100.0
			if v, ok := ei.data.routing["trafficPercent"]; ok {
				if f, ok := v.(float64); ok {
					trafficPercent = f
				}
			}

			edgeSrcType := srcNode.Data.NodeType
			item, cost := calculateEdgeEgress(srcRegion, tgtRegion, tgtNodeType, trafficPercent, srcMaxRPS*float64(tier.multiplier), edgeSrcType)
			if cost > 0 {
				egressItems = append(egressItems, item)
				totalEgress += cost
			}
		}

		if len(egressItems) > 0 {
			categoryMap["Data Transfer"] = egressItems
			catTotals["Data Transfer"] += totalEgress
			totalCost += totalEgress
		}

		breakdown := make([]CostCategory, 0)
		for _, cat := range categories {
			items := categoryMap[cat.Name]
			if len(items) == 0 {
				continue
			}
			breakdown = append(breakdown, CostCategory{
				Category: cat.Name,
				Items:    items,
				Subtotal: mathRound(catTotals[cat.Name], 2),
			})
		}

		projections = append(projections, CostEstimate{
			UserTier:         tier.label,
			MonthlyUsers:     tier.users,
			Multiplier:       tier.multiplier,
			TotalMonthlyCost: mathRound(totalCost, 2),
			Breakdown:        breakdown,
			DataEgressTotal:  mathRound(totalEgress, 2),
		})
	}

	var current CostEstimate
	if len(projections) > 0 {
		current = projections[0]
	}

	recs := generateRecommendations(nodes, projections)

	report := &CostReport{
		ProjectID:          projectID,
		MonthlyUsers:       monthlyUsers,
		CurrentEstimate:    current,
		ScalingProjections: projections,
		Recommendations:    recs,
		GeneratedAt:        time.Now().UTC().Format(time.RFC3339),
	}

	return report, nil
}

func categoryForType(nt NodeType) string {
	for _, cat := range categories {
		for _, t := range cat.Types {
			if t == nt {
				return cat.Name
			}
		}
	}
	return "Other"
}

func generateRecommendations(nodes []nodeInfo, projections []CostEstimate) []Recommendation {
	recs := make([]Recommendation, 0)

	var (
		hasCompute         bool
		hasDB              bool
		hasCache           bool
		hasMultiRegion     bool
		hasLoadBalancer    bool
		hasAutoScale       bool
		hasServerless      bool
		computeCount       int
	)

	for _, info := range nodes {
		switch info.nodeType {
		case NodeWebServer, NodeAppServer, NodeMicroservice, NodeWorkerService:
			hasCompute = true
			computeCount += getInstances(info.config)
		case NodePostgreSQLDB, NodeMySQLDB, NodeMongoDB:
			hasDB = true
		case NodeRedis:
			hasCache = true
		case NodeLoadBalancer:
			hasLoadBalancer = true
		case NodeServerless:
			hasServerless = true
		}

		tier := getComputeTier(info.config)
		if tier == ComputeTierSpot {
			hasAutoScale = true
		}
	}

	if computeCount >= 3 {
		if hasLoadBalancer {
			annual := float64(computeCount) * BaseComputeMonthly * 0.30 * 12
			recs = append(recs, Recommendation{
				Title:            "Reserved Instances (1-year)",
				Description:      fmt.Sprintf("Commit to %d compute instances for 1 year and save ~40%% vs on-demand pricing.", computeCount),
				PotentialSavings: mathRound(annual/12, 2),
				AnnualSavings:    mathRound(annual, 2),
				Effort:           "low",
			})
		}
	}

	if hasCompute && !hasAutoScale {
		savings := float64(computeCount) * BaseComputeMonthly * 0.15
		recs = append(recs, Recommendation{
			Title:            "Auto Scaling",
			Description:      "Configure auto-scaling groups to match capacity with demand. Reduce over-provisioning by up to 15%.",
			PotentialSavings: mathRound(savings, 2),
			AnnualSavings:    mathRound(savings*12, 2),
			Effort:           "medium",
		})
	}

	if hasCompute && computeCount >= 5 {
		annual := float64(computeCount) * BaseComputeMonthly * 0.60 * 12
		recs = append(recs, Recommendation{
			Title:            "Spot Instances",
			Description:      fmt.Sprintf("Use spot instances for %d fault-tolerant compute nodes. Save up to 60%% on compute costs.", int(float64(computeCount)*0.7)),
			PotentialSavings: mathRound(annual/12, 2),
			AnnualSavings:    mathRound(annual, 2),
			Effort:           "medium",
		})
	}

	if hasDB && !hasCache {
		savings := 50.00 * 0.20
		recs = append(recs, Recommendation{
			Title:            "Add Caching Layer (Redis)",
			Description:      "Introduce a Redis cache to reduce database read load. Can cut DB instance costs by ~20% and improve latency.",
			PotentialSavings: mathRound(savings, 2),
			AnnualSavings:    mathRound(savings*12, 2),
			Effort:           "medium",
		})
	}

	if hasDB {
		recs = append(recs, Recommendation{
			Title:            "Database Read Replicas",
			Description:      "Add read replicas to offload SELECT queries from the primary. Improves performance at scale with moderate cost increase.",
			PotentialSavings: 0,
			AnnualSavings:    0,
			Effort:           "medium",
		})
	}

	if hasServerless {
		savings := 200.0
		recs = append(recs, Recommendation{
			Title:            "Provisioned Concurrency",
			Description:      "Enable provisioned concurrency for serverless functions to reduce cold starts and optimize request pricing at scale.",
			PotentialSavings: mathRound(savings, 2),
			AnnualSavings:    mathRound(savings*12, 2),
			Effort:           "medium",
		})
	}

	multiYear := false
	for _, p := range projections {
		if p.MonthlyUsers >= 100_000 {
			multiYear = true
		}
	}
	if multiYear {
		annual := float64(computeCount) * BaseComputeMonthly * 0.40 * 12
		recs = append(recs, Recommendation{
			Title:            "Reserved Instances (3-year)",
			Description:      "With projected growth beyond 100k users, commit to 3-year Reserved Instances for up to 40% savings over on-demand.",
			PotentialSavings: mathRound(annual/12, 2),
			AnnualSavings:    mathRound(annual, 2),
			Effort:           "low",
		})
	}

	if hasMultiRegion {
		recs = append(recs, Recommendation{
			Title:            "Multi-Region Deployment",
			Description:      "Deploying across multiple regions increases resilience but doubles infrastructure costs. Consider active-passive for cost efficiency.",
			PotentialSavings: 0,
			AnnualSavings:    0,
			Effort:           "high",
		})
	}

	// Data egress optimization
	if len(nodes) > 0 {
		recs = append(recs, Recommendation{
			Title:            "Data Egress Optimization",
			Description:      "Use CloudFront CDN and regional caching to reduce inter-region and internet data transfer costs. Can reduce egress bills by 30-50%.",
			PotentialSavings: 0,
			AnnualSavings:    0,
			Effort:           "medium",
		})
	}

	if len(recs) == 0 {
		recs = append(recs, Recommendation{
			Title:            "Right-Sizing Review",
			Description:      "Review your instance sizes and resource allocations. Many workloads are over-provisioned by 20-40%.",
			PotentialSavings: 0,
			AnnualSavings:    0,
			Effort:           "low",
		})
	}

	return recs
}

func mathRound(v float64, decimals int) float64 {
	pow := math.Pow(10, float64(decimals))
	return math.Round(v*pow) / pow
}
