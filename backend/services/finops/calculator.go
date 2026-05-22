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
)

type PricingRule struct {
	NodeType    NodeType
	BaseMonthly float64
	PerInstance float64
	PerUnitDesc string
	UnitPrice   float64 // per unit (e.g. per GB, per 1k req)
}

var pricingRules = map[NodeType]PricingRule{
	NodeLoadBalancer:     {BaseMonthly: 16.43, PerInstance: 0, PerUnitDesc: "", UnitPrice: 0},
	NodeAPIGateway:       {BaseMonthly: 3.50, PerInstance: 0, PerUnitDesc: "per 1M requests", UnitPrice: 3.50},
	NodeWebServer:        {BaseMonthly: 0, PerInstance: 30.37, PerUnitDesc: "per instance (t3.medium)", UnitPrice: 0},
	NodeAppServer:        {BaseMonthly: 0, PerInstance: 30.37, PerUnitDesc: "per instance (t3.medium)", UnitPrice: 0},
	NodeMicroservice:     {BaseMonthly: 0, PerInstance: 30.37, PerUnitDesc: "per instance (t3.medium)", UnitPrice: 0},
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
	NodeBatchProcessor:   {BaseMonthly: 0, PerInstance: 30.37, PerUnitDesc: "per compute instance", UnitPrice: 0},
	NodeWorkerService:    {BaseMonthly: 0, PerInstance: 30.37, PerUnitDesc: "per instance (t3.medium)", UnitPrice: 0},
}

type categoryInfo struct {
	Name  string
	Types []NodeType
}

var categories = []categoryInfo{
	{Name: "Compute", Types: []NodeType{NodeWebServer, NodeAppServer, NodeMicroservice, NodeWorkerService, NodeBatchProcessor, NodeServerless}},
	{Name: "Networking", Types: []NodeType{NodeLoadBalancer, NodeAPIGateway, NodeCDN, NodeDNS, NodeFirewall, NodeVPC, NodeSubnet}},
	{Name: "Data & Storage", Types: []NodeType{NodePostgreSQLDB, NodeMySQLDB, NodeMongoDB, NodeRedis, NodeElasticsearch}},
	{Name: "Messaging & Events", Types: []NodeType{NodeMessageQueue, NodeEventBus, NodePubSub}},
	{Name: "Orchestration", Types: []NodeType{NodeContainerCluster}},
	{Name: "External", Types: []NodeType{NodeExternalClient, NodeThirdPartyAPI, NodeMobileClient, NodeWebBrowser}},
}

type canvasNode struct {
	ID   string `json:"id"`
	Data struct {
		NodeType NodeType                `json:"nodeType"`
		Label    string                  `json:"label"`
		Config   map[string]any          `json:"config"`
		Metrics  map[string]any          `json:"metrics"`
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
	UserTier        string         `json:"userTier"`
	MonthlyUsers    int            `json:"monthlyUsers"`
	Multiplier      float64        `json:"multiplier"`
	TotalMonthlyCost float64       `json:"totalMonthlyCost"`
	Breakdown       []CostCategory `json:"breakdown"`
}

type Recommendation struct {
	Title           string  `json:"title"`
	Description     string  `json:"description"`
	PotentialSavings float64 `json:"potentialSavings"`
	AnnualSavings   float64 `json:"annualSavings"`
	Effort          string  `json:"effort"`
}

type CostReport struct {
	ProjectID         string              `json:"projectId"`
	MonthlyUsers      int                 `json:"monthlyUsers"`
	CurrentEstimate   CostEstimate   `json:"currentEstimate"`
	ScalingProjections []CostEstimate `json:"scalingProjections"`
	Recommendations   []Recommendation    `json:"recommendations"`
	GeneratedAt       string              `json:"generatedAt"`
}

func getInstances(cfg map[string]any) int {
	if v, ok := cfg["instances"]; ok {
		if f, ok := v.(float64); ok {
			return int(f)
		}
	}
	return 1
}

func isServerless(nt NodeType) bool {
	return nt == NodeServerless || nt == NodeAPIGateway || nt == NodeMessageQueue || nt == NodeEventBus
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

func calculateNodeCost(nt NodeType, label string, cfg map[string]any, monthlyUsers int, multiplier float64) costResult {
	rule, ok := pricingRules[nt]
	if !ok {
		return costResult{}
	}

	instances := getInstances(cfg)
	scaledInstances := int(math.Ceil(float64(instances) * multiplier))
	if scaledInstances < 1 {
		scaledInstances = 1
	}

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
		cost := rule.PerInstance * float64(scaledInstances)
		items = append(items, CostLineItem{
			Service:     label,
			Description: fmt.Sprintf("%s — %d instance(s) (%s)", label, scaledInstances, rule.PerUnitDesc),
			UnitPrice:   rule.PerInstance,
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
		gbTransfer := float64(monthlyUsers) * 0.15 * multiplier // 150MB/user
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
		queries := float64(monthlyUsers) * 10 * multiplier // 10 DNS queries/user/month
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
	nodeType NodeType
	label    string
	config   map[string]any
}

func Calculate(canvasData []byte, projectID string, monthlyUsers int) (*CostReport, error) {
	var canvas struct {
		Nodes []canvasNode `json:"nodes"`
	}
	if err := json.Unmarshal(canvasData, &canvas); err != nil {
		return nil, fmt.Errorf("failed to parse canvas data: %w", err)
	}

	nodes := make([]nodeInfo, 0, len(canvas.Nodes))
	for _, n := range canvas.Nodes {
		nt := n.Data.NodeType
		if _, ok := pricingRules[nt]; !ok {
			continue
		}
		if nt == NodeExternalClient || nt == NodeThirdPartyAPI || nt == NodeMobileClient || nt == NodeWebBrowser {
			continue
		}
		nodes = append(nodes, nodeInfo{nodeType: nt, label: n.Data.Label, config: n.Data.Config})
	}

	if len(nodes) == 0 {
		return nil, fmt.Errorf("no billable resources found in the canvas")
	}

	projections := make([]CostEstimate, 0, len(userTiers))

	for _, tier := range userTiers {
		categoryMap := make(map[string][]CostLineItem)
		catTotals := make(map[string]float64)
		totalCost := 0.0

		for _, info := range nodes {
			result := calculateNodeCost(info.nodeType, info.label, info.config, tier.users, tier.multiplier)
			catName := categoryForType(info.nodeType)
			categoryMap[catName] = append(categoryMap[catName], result.items...)
			catTotals[catName] += result.total
			totalCost += result.total
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
		hasCompute     bool
		hasDB          bool
		hasCache       bool
		hasMultiRegion bool
		hasLoadBalancer bool
		hasAutoScale   bool
		computeCount   int
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
		}
	}

	if computeCount >= 3 {
		if hasLoadBalancer {
			annual := float64(computeCount) * 30.37 * 0.30 * 12 // 30% RI savings
			recs = append(recs, Recommendation{
				Title:            "Reserved Instances (1-year)",
				Description:      fmt.Sprintf("Commit to %d compute instances for 1 year and save ~30%% vs on-demand pricing.", computeCount),
				PotentialSavings: mathRound(annual/12, 2),
				AnnualSavings:    mathRound(annual, 2),
				Effort:           "low",
			})
		}
	}

	if hasCompute && !hasAutoScale {
		savings := float64(computeCount) * 30.37 * 0.15
		recs = append(recs, Recommendation{
			Title:            "Auto Scaling",
			Description:      "Configure auto-scaling groups to match capacity with demand. Reduce over-provisioning by up to 15%.",
			PotentialSavings: mathRound(savings, 2),
			AnnualSavings:    mathRound(savings*12, 2),
			Effort:           "medium",
		})
	}

	if hasCompute && computeCount >= 5 {
		annual := float64(computeCount) * 30.37 * 0.60 * 12
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

	multiYear := false
	for _, p := range projections {
		if p.MonthlyUsers >= 100_000 {
			multiYear = true
		}
	}
	if multiYear {
		annual := float64(computeCount) * 30.37 * 0.40 * 12
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
