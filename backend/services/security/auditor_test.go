package security

import (
	"testing"
)

func TestUnencryptedTransitDetection(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "web", NodeType: "WebServer", Label: "Web Server", Security: SecurityConfig{IsPublicFacing: true, RequiresTLS: true}},
			{ID: "db", NodeType: "PostgreSQLDB", Label: "Database", Security: SecurityConfig{RequiresTLS: false}},
		},
		Edges: []Edge{
			{ID: "e1", Source: "web", Target: "db", RequiresTLS: true},
		},
	}
	auditor := NewSecurityAuditor(graph)
	violations := auditor.Audit()

	found := false
	for _, v := range violations {
		if v.Type == ViolationUnencryptedTransit && v.SourceNodeID == "web" && v.TargetNodeID == "db" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected unencrypted_transit violation between web and db")
	}
}

func TestPublicDatabaseDetection(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "client", NodeType: "ExternalClient", Label: "External User",
				Security: SecurityConfig{VpcID: "vpc-main"}},
			{ID: "db", NodeType: "PostgreSQLDB", Label: "Database",
				Security: SecurityConfig{VpcID: "vpc-main"}},
		},
		Edges: []Edge{
			{ID: "e1", Source: "client", Target: "db"},
		},
	}
	auditor := NewSecurityAuditor(graph)
	violations := auditor.Audit()

	found := false
	for _, v := range violations {
		if v.Type == ViolationPublicDatabase && v.TargetNodeID == "db" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected public_database violation for database accessible from external user")
	}
}

func TestDatabaseBehindFirewallIsNotPublic(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "firewall", NodeType: "Firewall", Label: "WAF"},
			{ID: "web", NodeType: "WebServer", Label: "Web", Security: SecurityConfig{IsPublicFacing: true}},
			{ID: "db", NodeType: "PostgreSQLDB", Label: "DB", Security: SecurityConfig{IsPublicFacing: false}},
		},
		Edges: []Edge{
			{ID: "e1", Source: "firewall", Target: "web", RequiresTLS: true},
			{ID: "e2", Source: "web", Target: "db", RequiresTLS: true},
		},
	}
	auditor := NewSecurityAuditor(graph)
	violations := auditor.Audit()

	for _, v := range violations {
		if v.Type == ViolationPublicDatabase {
			t.Errorf("unexpected public_database violation for non-public DB: %s", v.Message)
		}
	}
}

func TestCleanArchitectureZeroViolations(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "waf", NodeType: "Firewall", Label: "WAF",
				Security: SecurityConfig{AllowedInbound: []string{"0.0.0.0/0"}}},
			{ID: "web", NodeType: "WebServer", Label: "Web Server",
				Security: SecurityConfig{IsPublicFacing: true, RequiresTLS: true, AllowedInbound: []string{"0.0.0.0/0"}}},
			{ID: "app", NodeType: "AppServer", Label: "App Server",
				Security: SecurityConfig{IsPublicFacing: false, RequiresTLS: true, AllowedInbound: []string{"10.0.1.0/24"}}},
			{ID: "db", NodeType: "PostgreSQLDB", Label: "Database",
				Security: SecurityConfig{IsPublicFacing: false, RequiresTLS: true, AllowedInbound: []string{"10.0.1.0/24"}}},
			{ID: "cache", NodeType: "Redis", Label: "Cache",
				Security: SecurityConfig{IsPublicFacing: false, RequiresTLS: false, AllowedInbound: []string{"10.0.1.0/24"}}},
		},
		Edges: []Edge{
			{ID: "e1", Source: "waf", Target: "web", RequiresTLS: true},
			{ID: "e2", Source: "web", Target: "app", RequiresTLS: true},
			{ID: "e3", Source: "app", Target: "db", RequiresTLS: true},
			{ID: "e4", Source: "app", Target: "cache", RequiresTLS: false},
		},
	}
	auditor := NewSecurityAuditor(graph)
	violations := auditor.Audit()
	if len(violations) != 0 {
		t.Errorf("expected zero violations for clean architecture, got %d:", len(violations))
		for _, v := range violations {
			t.Logf("  [%s] %s: %s", v.Severity, v.Type, v.Message)
		}
	}
}

func TestParseCanvasDataWithSecurity(t *testing.T) {
	raw := []byte(`{
		"nodes": [
			{"id":"web","data":{"nodeType":"WebServer","label":"Web","config":{"security":{"isPublicFacing":true,"requiresTLS":true,"allowedInbound":["0.0.0.0/0"]}}}},
			{"id":"db","data":{"nodeType":"PostgreSQLDB","label":"DB","config":{"security":{"isPublicFacing":false,"requiresTLS":false,"allowedInbound":["10.0.0.0/8"]}}}}
		],
		"edges": [
			{"id":"e1","source":"web","target":"db","data":{"routing":{"requiresTLS":true}}}
		]
	}`)
	graph, err := ParseCanvasData(raw)
	if err != nil {
		t.Fatalf("ParseCanvasData failed: %v", err)
	}
	if len(graph.Nodes) != 2 {
		t.Errorf("expected 2 nodes, got %d", len(graph.Nodes))
	}
	if len(graph.Edges) != 1 {
		t.Errorf("expected 1 edge, got %d", len(graph.Edges))
	}
	if !graph.Nodes[0].Security.IsPublicFacing {
		t.Error("web node should be public facing")
	}
	if graph.Nodes[1].Security.IsPublicFacing {
		t.Error("db node should not be public facing")
	}
	auditor := NewSecurityAuditor(graph)
	violations := auditor.Audit()
	foundUnencrypted := false
	for _, v := range violations {
		if v.SourceNodeID == "web" && v.TargetNodeID == "db" && v.Type == ViolationUnencryptedTransit {
			foundUnencrypted = true
		}
	}
	if !foundUnencrypted {
		t.Error("expected unencrypted_transit violation for edge without TLS")
	}
}

func TestParseCanvasDataInvalidJSON(t *testing.T) {
	_, err := ParseCanvasData([]byte(`{invalid`))
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}
