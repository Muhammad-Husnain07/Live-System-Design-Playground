package finops

import (
	"encoding/json"
	"math"
	"testing"
)

func TestMathRound(t *testing.T) {
	tests := []struct {
		v        float64
		dec      int
		expected float64
	}{
		{12.3456, 0, 12},
		{12.3456, 1, 12.3},
		{12.3456, 2, 12.35},
		{12.9999, 1, 13.0},
	}
	for _, tc := range tests {
		got := mathRound(tc.v, tc.dec)
		if math.Abs(got-tc.expected) > 0.001 {
			t.Errorf("mathRound(%v, %d) = %v, want %v", tc.v, tc.dec, got, tc.expected)
		}
	}
}

func TestGetInstances(t *testing.T) {
	cfg := map[string]any{"instances": float64(5)}
	if v := getInstances(cfg); v != 5 {
		t.Errorf("getInstances = %d, want 5", v)
	}
	if v := getInstances(map[string]any{}); v != 1 {
		t.Errorf("getInstances (empty) = %d, want 1", v)
	}
}

func TestIsServerless(t *testing.T) {
	if !isServerless(NodeServerless) {
		t.Error("Serverless should be serverless")
	}
	if !isServerless(NodeAPIGateway) {
		t.Error("APIGateway should be serverless")
	}
	if isServerless(NodeWebServer) {
		t.Error("WebServer should not be serverless")
	}
}

func TestCategoryForType(t *testing.T) {
	if cat := categoryForType(NodeWebServer); cat != "Compute" {
		t.Errorf("categoryForType(WebServer) = %q, want Compute", cat)
	}
	if cat := categoryForType(NodeDNS); cat != "Networking" {
		t.Errorf("categoryForType(DNS) = %q, want Networking", cat)
	}
	if cat := categoryForType(NodeContainerCluster); cat != "Orchestration" {
		t.Errorf("categoryForType(ContainerCluster) = %q, want Orchestration", cat)
	}
	if cat := categoryForType("UnknownType"); cat != "Other" {
		t.Errorf("categoryForType(Unknown) = %q, want Other", cat)
	}
}

func TestCalculateNodeCost(t *testing.T) {
	result := calculateNodeCost(NodeWebServer, "web", map[string]any{"instances": float64(2)}, 1000, 1.0)
	if len(result.items) == 0 {
		t.Fatal("expected cost items for WebServer")
	}
	foundInstanceItem := false
	for _, item := range result.items {
		if item.Quantity == 2 && item.UnitPrice == 30.37 {
			foundInstanceItem = true
		}
	}
	if !foundInstanceItem {
		t.Error("expected per-instance cost item for 2 instances at $30.37 each")
	}

	resultCDN := calculateNodeCost(NodeCDN, "cdn", map[string]any{}, 10000, 1.0)
	if len(resultCDN.items) == 0 {
		t.Fatal("expected cost items for CDN")
	}

	emptyResult := calculateNodeCost("NonExistentType", "x", map[string]any{}, 1000, 1.0)
	if len(emptyResult.items) != 0 {
		t.Error("expected empty result for unknown node type")
	}
}

func TestCalculateEmptyCanvas(t *testing.T) {
	emptyCanvas := `{"nodes":[]}`
	_, err := Calculate([]byte(emptyCanvas), "proj-1", 1000)
	if err == nil {
		t.Error("expected error for empty canvas")
	}
}

func TestCalculateOnlyClientNodes(t *testing.T) {
	canvas := `{"nodes":[{"id":"e1","data":{"nodeType":"ExternalClient","label":"Client","config":{}}}]}`
	_, err := Calculate([]byte(canvas), "proj-1", 1000)
	if err == nil {
		t.Error("expected error when only client nodes exist")
	}
}

func TestCalculateWithValidCanvas(t *testing.T) {
	canvas := `{
		"nodes": [
			{"id":"lb-1","type":"default","position":{"x":0,"y":0},"data":{"nodeType":"LoadBalancer","label":"LB","config":{"instances":2,"maxRPS":50000,"latencyMs":1,"errorRate":0}}},
			{"id":"web-1","type":"default","position":{"x":200,"y":0},"data":{"nodeType":"WebServer","label":"Web","config":{"instances":3,"maxRPS":4000,"latencyMs":20,"errorRate":0}}},
			{"id":"db-1","type":"default","position":{"x":400,"y":0},"data":{"nodeType":"PostgreSQLDB","label":"DB","config":{"instances":2,"maxRPS":10000,"latencyMs":5,"errorRate":0}}}
		],
		"edges": []
	}`

	report, err := Calculate([]byte(canvas), "proj-1", 1000)
	if err != nil {
		t.Fatalf("Calculate failed: %v", err)
	}

	if report.ProjectID != "proj-1" {
		t.Errorf("ProjectID = %q, want proj-1", report.ProjectID)
	}

	if len(report.ScalingProjections) != 4 {
		t.Errorf("expected 4 scaling projections, got %d", len(report.ScalingProjections))
	}

	if report.CurrentEstimate.TotalMonthlyCost <= 0 {
		t.Error("expected positive total monthly cost")
	}

	if len(report.CurrentEstimate.Breakdown) == 0 {
		t.Error("report current estimate should have breakdown categories")
	}

	series := report.ScalingProjections[0]
	if len(series.Breakdown) == 0 {
		t.Error("scaling projection should have breakdown")
	}
}

func TestCalculateWithAllNodeTypes(t *testing.T) {
	nodes := make([]map[string]any, 0)
	for nt := range pricingRules {
		if nt == NodeExternalClient || nt == NodeThirdPartyAPI || nt == NodeMobileClient || nt == NodeWebBrowser {
			continue
		}
		nodes = append(nodes, map[string]any{
			"id":   string(nt) + "-1",
			"type": "default",
			"data": map[string]any{
				"nodeType": nt,
				"label":    string(nt),
				"config":   map[string]any{"instances": 1},
			},
		})
	}
	canvas := map[string]any{"nodes": nodes, "edges": []any{}}
	raw, _ := json.Marshal(canvas)
	report, err := Calculate(raw, "proj-all", 1000)
	if err != nil {
		t.Fatalf("Calculate with all types failed: %v", err)
	}
	if len(report.ScalingProjections) != 4 {
		t.Errorf("expected 4 projections, got %d", len(report.ScalingProjections))
	}
}

func TestCalculateNodeCostScaling(t *testing.T) {
	cfg := map[string]any{"instances": float64(2)}
	base := calculateNodeCost(NodeWebServer, "web", cfg, 1000, 1.0)
	scaled := calculateNodeCost(NodeWebServer, "web", cfg, 1000, 3.0)
	if scaled.total <= base.total {
		t.Error("scaled cost should be greater than base cost")
	}
}

func TestGenerateRecommendationsEmpty(t *testing.T) {
	recs := generateRecommendations([]nodeInfo{}, []CostEstimate{})
	if len(recs) == 0 {
		t.Error("should always return at least one recommendation")
	}
}

func TestGenerateRecommendationsWithCompute(t *testing.T) {
	nodes := []nodeInfo{
		{nodeType: NodeWebServer, label: "web", config: map[string]any{"instances": float64(6)}},
		{nodeType: NodeLoadBalancer, label: "lb", config: map[string]any{"instances": float64(2)}},
	}
	projections := []CostEstimate{
		{UserTier: "1M users (scale)", MonthlyUsers: 1_000_000, Multiplier: 30},
	}
	recs := generateRecommendations(nodes, projections)
	foundReserved := false
	foundSpot := false
	for _, r := range recs {
		if r.Title == "Reserved Instances (1-year)" {
			foundReserved = true
		}
		if r.Title == "Spot Instances" {
			foundSpot = true
		}
	}
	if !foundReserved {
		t.Error("expected Reserved Instances recommendation with 6 compute instances and LB")
	}
	if !foundSpot {
		t.Error("expected Spot Instances recommendation with >=5 compute nodes")
	}
}

func TestGenerateRecommendationsDBWithoutCache(t *testing.T) {
	nodes := []nodeInfo{
		{nodeType: NodePostgreSQLDB, label: "db", config: map[string]any{"instances": float64(2)}},
	}
	recs := generateRecommendations(nodes, []CostEstimate{})
	found := false
	for _, r := range recs {
		if r.Title == "Add Caching Layer (Redis)" {
			found = true
		}
	}
	if !found {
		t.Error("expected Add Caching Layer recommendation when DB exists without cache")
	}
}

func TestGenerateRecommendationsMultiRegion(t *testing.T) {
	nodes := []nodeInfo{
		{nodeType: NodeWebServer, label: "web", config: map[string]any{"instances": float64(2)}},
	}
	projections := []CostEstimate{
		{UserTier: "1M users (scale)", MonthlyUsers: 1_000_000, Multiplier: 30},
	}
	recs := generateRecommendations(nodes, projections)
	found3Year := false
	for _, r := range recs {
		if r.Title == "Reserved Instances (3-year)" {
			found3Year = true
		}
	}
	if !found3Year {
		t.Error("expected 3-year Reserved Instances recommendation for 1M user tier")
	}
}

func TestCostEstimateJSON(t *testing.T) {
	est := CostEstimate{
		UserTier:         "test",
		MonthlyUsers:     1000,
		Multiplier:       1,
		TotalMonthlyCost: 100.50,
		Breakdown: []CostCategory{
			{Category: "Compute", Items: []CostLineItem{
				{Service: "web", Description: "web instance", UnitPrice: 30.37, Quantity: 2, MonthlyCost: 60.74},
			}, Subtotal: 60.74},
		},
	}
	data, err := json.Marshal(est)
	if err != nil {
		t.Fatalf("failed to marshal CostEstimate: %v", err)
	}
	var decoded CostEstimate
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal CostEstimate: %v", err)
	}
	if decoded.TotalMonthlyCost != 100.50 {
		t.Errorf("TotalMonthlyCost = %v, want 100.50", decoded.TotalMonthlyCost)
	}
}

func TestRecommendationJSON(t *testing.T) {
	rec := Recommendation{
		Title:            "Test Rec",
		Description:      "A test recommendation",
		PotentialSavings: 100,
		AnnualSavings:    1200,
		Effort:           "low",
	}
	data, err := json.Marshal(rec)
	if err != nil {
		t.Fatalf("failed to marshal Recommendation: %v", err)
	}
	var decoded Recommendation
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal Recommendation: %v", err)
	}
	if decoded.Title != "Test Rec" {
		t.Errorf("Title = %q, want Test Rec", decoded.Title)
	}
	if decoded.Effort != "low" {
		t.Errorf("Effort = %q, want low", decoded.Effort)
	}
}

func TestPricingRulesCoverage(t *testing.T) {
	coveredTypes := []NodeType{
		NodeLoadBalancer, NodeAPIGateway, NodeWebServer, NodeAppServer,
		NodeMicroservice, NodePostgreSQLDB, NodeMySQLDB, NodeMongoDB,
		NodeRedis, NodeElasticsearch, NodeCDN, NodeDNS, NodeFirewall,
		NodeVPC, NodeSubnet, NodeMessageQueue, NodeEventBus, NodePubSub,
		NodeContainerCluster, NodeServerless, NodeBatchProcessor, NodeWorkerService,
	}
	for _, nt := range coveredTypes {
		if _, ok := pricingRules[nt]; !ok {
			t.Errorf("missing pricing rule for %s", nt)
		}
	}
}

func TestUserTiers(t *testing.T) {
	if len(userTiers) != 4 {
		t.Errorf("expected 4 user tiers, got %d", len(userTiers))
	}
	expectedLabels := []string{"1k users (prototype)", "10k users (launch)", "100k users (growth)", "1M users (scale)"}
	for i, tier := range userTiers {
		if tier.label != expectedLabels[i] {
			t.Errorf("tier %d label = %q, want %q", i, tier.label, expectedLabels[i])
		}
		if tier.users <= 0 {
			t.Errorf("tier %d users = %d, want > 0", i, tier.users)
		}
	}
	if userTiers[0].multiplier != 1 || userTiers[3].multiplier != 30 {
		t.Errorf("unexpected multiplier progression")
	}
}

func TestCalculateNodeCostRedis(t *testing.T) {
	result := calculateNodeCost(NodeRedis, "cache", map[string]any{"instances": float64(2)}, 1000, 1.0)
	hasBase := false
	for _, item := range result.items {
		if item.UnitPrice == 15.00 && item.Quantity == 1 {
			hasBase = true
		}
	}
	if !hasBase {
		t.Error("expected Redis base cost item at $15.00")
	}
}

func TestCalculateNodeCostServerless(t *testing.T) {
	result := calculateNodeCost(NodeServerless, "fn", map[string]any{}, 10000, 1.0)
	if len(result.items) == 0 {
		t.Fatal("expected cost items for Serverless")
	}
}

func TestCalculateNodeCostPostgreSQL(t *testing.T) {
	result := calculateNodeCost(NodePostgreSQLDB, "pg", map[string]any{"instances": float64(2)}, 1000, 1.0)
	hasBase := false
	for _, item := range result.items {
		if item.UnitPrice == 50.00 && item.Quantity == 1 {
			hasBase = true
		}
	}
	if !hasBase {
		t.Error("expected PostgreSQL base cost at $50.00")
	}
}

func TestCostLineItemJSONRoundTrip(t *testing.T) {
	item := CostLineItem{Service: "test", Description: "desc", UnitPrice: 10.50, Quantity: 3, MonthlyCost: 31.50}
	data, err := json.Marshal(item)
	if err != nil {
		t.Fatal(err)
	}
	var decoded CostLineItem
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.MonthlyCost != 31.50 {
		t.Errorf("MonthlyCost = %v, want 31.50", decoded.MonthlyCost)
	}
}

func TestCostReportJSONRoundTrip(t *testing.T) {
	report := &CostReport{
		ProjectID:    "proj-1",
		MonthlyUsers: 1000,
		CurrentEstimate: CostEstimate{
			UserTier: "1k users (prototype)", MonthlyUsers: 1000, Multiplier: 1, TotalMonthlyCost: 100,
		},
		ScalingProjections: []CostEstimate{
			{UserTier: "10k users (launch)", MonthlyUsers: 10000, Multiplier: 3, TotalMonthlyCost: 300},
		},
		Recommendations: []Recommendation{
			{Title: "Right-Sizing Review", Effort: "low"},
		},
		GeneratedAt: "2026-01-01T00:00:00Z",
	}
	data, err := json.Marshal(report)
	if err != nil {
		t.Fatal(err)
	}
	var decoded CostReport
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.ProjectID != "proj-1" {
		t.Errorf("ProjectID = %q, want proj-1", decoded.ProjectID)
	}
	if len(decoded.ScalingProjections) != 1 {
		t.Errorf("expected 1 projection, got %d", len(decoded.ScalingProjections))
	}
}
