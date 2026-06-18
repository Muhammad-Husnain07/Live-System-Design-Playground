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
				Security: SecurityConfig{IsPublicFacing: false, RequiresTLS: true, AllowedInbound: []string{"10.0.1.0/24"}}},
		},
		Edges: []Edge{
			{ID: "e1", Source: "waf", Target: "web", RequiresTLS: true, AuthRequired: false},
			{ID: "e2", Source: "web", Target: "app", RequiresTLS: true, AuthRequired: true},
			{ID: "e3", Source: "app", Target: "db", RequiresTLS: true, AuthRequired: true},
			{ID: "e4", Source: "app", Target: "cache", RequiresTLS: true, AuthRequired: true},
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

// Cross-VPC Unfirewalled: nodes in different VPCs connect without firewall
func TestCrossVPCUnfirewalledDetection(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "app", NodeType: "AppServer", Label: "App Server", Security: SecurityConfig{VpcID: "vpc-a"}},
			{ID: "db", NodeType: "PostgreSQLDB", Label: "Database", Security: SecurityConfig{VpcID: "vpc-b"}},
		},
		Edges: []Edge{
			{ID: "e1", Source: "app", Target: "db"},
		},
	}
	auditor := NewSecurityAuditor(graph)
	violations := auditor.Audit()

	found := false
	for _, v := range violations {
		if v.Type == ViolationCrossVPCUnfirewalled && v.SourceNodeID == "app" && v.TargetNodeID == "db" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected cross_vpc_unfirewalled violation between different VPCs")
	}
}

func TestCrossVPCUnfirewalled_SameVPC_NoViolation(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "app", NodeType: "AppServer", Label: "App", Security: SecurityConfig{VpcID: "vpc-main"}},
			{ID: "db", NodeType: "PostgreSQLDB", Label: "DB", Security: SecurityConfig{VpcID: "vpc-main"}},
		},
		Edges: []Edge{
			{ID: "e1", Source: "app", Target: "db"},
		},
	}
	violations := NewSecurityAuditor(graph).Audit()
	for _, v := range violations {
		if v.Type == ViolationCrossVPCUnfirewalled {
			t.Error("expected no cross_vpc_unfirewalled violation within same VPC")
		}
	}
}

func TestCrossVPCUnfirewalled_FirewallProtects_NoViolation(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "app", NodeType: "AppServer", Label: "App", Security: SecurityConfig{VpcID: "vpc-a"}},
			{ID: "fw", NodeType: "Firewall", Label: "WAF", Security: SecurityConfig{VpcID: "vpc-a"}},
			{ID: "db", NodeType: "PostgreSQLDB", Label: "DB", Security: SecurityConfig{VpcID: "vpc-b"}},
		},
		Edges: []Edge{
			{ID: "e1", Source: "app", Target: "fw"},
			{ID: "e2", Source: "fw", Target: "db"},
		},
	}
	violations := NewSecurityAuditor(graph).Audit()
	for _, v := range violations {
		if v.Type == ViolationCrossVPCUnfirewalled {
			t.Error("expected no cross_vpc_unfirewalled violation when firewall mediates")
		}
	}
}

// SSRF Vectors: compute node receives external traffic AND has internal DB access
func TestSSRFVectorDetection(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "client", NodeType: "ExternalClient", Label: "External User"},
			{ID: "app", NodeType: "AppServer", Label: "App Server"},
			{ID: "db", NodeType: "PostgreSQLDB", Label: "Internal DB"},
		},
		Edges: []Edge{
			{ID: "e1", Source: "client", Target: "app"},
			{ID: "e2", Source: "app", Target: "db"},
		},
	}
	auditor := NewSecurityAuditor(graph)
	violations := auditor.Audit()

	found := false
	for _, v := range violations {
		if v.Type == ViolationSSRF && v.SourceNodeID == "app" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected ssrf_vector violation for app server with external access to internal DB")
	}
}

func TestSSRFVector_ProtectedByGateway_NoViolation(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "client", NodeType: "ExternalClient", Label: "External"},
			{ID: "gw", NodeType: "APIGateway", Label: "API Gateway"},
			{ID: "app", NodeType: "AppServer", Label: "App Server"},
			{ID: "db", NodeType: "PostgreSQLDB", Label: "DB"},
		},
		Edges: []Edge{
			{ID: "e1", Source: "client", Target: "gw"},
			{ID: "e2", Source: "gw", Target: "app"},
			{ID: "e3", Source: "app", Target: "db"},
		},
	}
	violations := NewSecurityAuditor(graph).Audit()
	for _, v := range violations {
		if v.Type == ViolationSSRF {
			t.Errorf("unexpected SSRF violation when gateway protects: %s", v.Message)
		}
	}
}

// IAM Privilege Escalation: lower-tier service connects to admin-permission node
func TestIAMPrivilegeEscalationDetection(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "worker", NodeType: "WorkerService", Label: "Worker", Permissions: "read-only"},
			{ID: "admin", NodeType: "AppServer", Label: "Admin Service", Permissions: "Admin:*"},
		},
		Edges: []Edge{
			{ID: "e1", Source: "worker", Target: "admin"},
		},
	}
	auditor := NewSecurityAuditor(graph)
	violations := auditor.Audit()

	found := false
	for _, v := range violations {
		if v.Type == ViolationIAMPrivilegeEscalation && v.SourceNodeID == "worker" && v.TargetNodeID == "admin" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected iam_privilege_escalation violation for worker accessing admin node")
	}
}

func TestIAMPrivilegeEscalation_NoAdminPermissions_NoViolation(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "worker", NodeType: "WorkerService", Label: "Worker", Permissions: "read-only"},
			{ID: "svc", NodeType: "AppServer", Label: "Service", Permissions: "read-only"},
		},
		Edges: []Edge{
			{ID: "e1", Source: "worker", Target: "svc"},
		},
	}
	violations := NewSecurityAuditor(graph).Audit()
	for _, v := range violations {
		if v.Type == ViolationIAMPrivilegeEscalation {
			t.Errorf("unexpected IAM escalation violation for non-admin target: %s", v.Message)
		}
	}
}

// Missing Authentication: API Gateway/LB routes to compute without auth
func TestMissingAuthenticationDetection(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "gw", NodeType: "APIGateway", Label: "API Gateway"},
			{ID: "app", NodeType: "AppServer", Label: "App Server"},
		},
		Edges: []Edge{
			{ID: "e1", Source: "gw", Target: "app", RequiresTLS: true, AuthRequired: false},
		},
	}
	auditor := NewSecurityAuditor(graph)
	violations := auditor.Audit()

	found := false
	for _, v := range violations {
		if v.Type == ViolationMissingAuth && v.SourceNodeID == "gw" && v.TargetNodeID == "app" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected missing_authentication violation for gateway to app without auth")
	}
}

func TestMissingAuthentication_WithAuth_NoViolation(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "gw", NodeType: "APIGateway", Label: "API Gateway"},
			{ID: "app", NodeType: "AppServer", Label: "App Server"},
		},
		Edges: []Edge{
			{ID: "e1", Source: "gw", Target: "app", AuthRequired: true},
		},
	}
	violations := NewSecurityAuditor(graph).Audit()
	for _, v := range violations {
		if v.Type == ViolationMissingAuth {
			t.Errorf("unexpected missing_auth violation when auth is required: %s", v.Message)
		}
	}
}

// Implicit Trust (mTLS check): internal nodes connect without mTLS
func TestImplicitTrustDetection(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "app", NodeType: "AppServer", Label: "App Server"},
			{ID: "db", NodeType: "PostgreSQLDB", Label: "Database"},
		},
		Edges: []Edge{
			{ID: "e1", Source: "app", Target: "db", RequiresTLS: false, AuthRequired: false},
		},
	}
	auditor := NewSecurityAuditor(graph)
	violations := auditor.Audit()

	found := false
	for _, v := range violations {
		if v.Type == ViolationImplicitTrust && v.SourceNodeID == "app" && v.TargetNodeID == "db" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected implicit_trust violation for internal nodes without mTLS")
	}
}

func TestImplicitTrust_WithMTLS_NoViolation(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "app", NodeType: "AppServer", Label: "App Server"},
			{ID: "db", NodeType: "PostgreSQLDB", Label: "Database"},
		},
		Edges: []Edge{
			{ID: "e1", Source: "app", Target: "db", RequiresTLS: true, AuthRequired: true},
		},
	}
	violations := NewSecurityAuditor(graph).Audit()
	for _, v := range violations {
		if v.Type == ViolationImplicitTrust {
			t.Errorf("unexpected implicit_trust violation when mTLS is enabled: %s", v.Message)
		}
	}
}

func TestImplicitTrust_ExternalNodes_NoViolation(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "client", NodeType: "ExternalClient", Label: "Client"},
			{ID: "app", NodeType: "AppServer", Label: "App"},
		},
		Edges: []Edge{
			{ID: "e1", Source: "client", Target: "app"},
		},
	}
	violations := NewSecurityAuditor(graph).Audit()
	for _, v := range violations {
		if v.Type == ViolationImplicitTrust {
			t.Errorf("unexpected implicit_trust for external-to-internal edge: %s", v.Message)
		}
	}
}

// Public Secrets: public-facing serverless node with inline credentials
func TestPublicSecretDetection(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "fn", NodeType: "ServerlessFunction", Label: "Auth Function",
				Security: SecurityConfig{IsPublicFacing: true}, Permissions: "arn:aws:iam::123:role/app-secret-role"},
		},
	}
	auditor := NewSecurityAuditor(graph)
	violations := auditor.Audit()

	found := false
	for _, v := range violations {
		if v.Type == ViolationPublicSecret && v.SourceNodeID == "fn" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected public_secret violation for public serverless with secret in permissions")
	}
}

func TestPublicSecret_NonPublic_NoViolation(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "fn", NodeType: "ServerlessFunction", Label: "Internal Func",
				Security: SecurityConfig{IsPublicFacing: false}, Permissions: "arn:aws:iam::123:role/secret"},
		},
	}
	violations := NewSecurityAuditor(graph).Audit()
	for _, v := range violations {
		if v.Type == ViolationPublicSecret {
			t.Errorf("unexpected public_secret for non-public function: %s", v.Message)
		}
	}
}

func TestPublicSecret_NoSecretKeywords_NoViolation(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "fn", NodeType: "ServerlessFunction", Label: "Public Func",
				Security: SecurityConfig{IsPublicFacing: true}, Permissions: "read-only"},
		},
	}
	violations := NewSecurityAuditor(graph).Audit()
	for _, v := range violations {
		if v.Type == ViolationPublicSecret {
			t.Errorf("unexpected public_secret for permissions without secret keywords: %s", v.Message)
		}
	}
}

// LLM Injection: external client has direct path to LLM node
func TestLLMInjectionDetection(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "client", NodeType: "ExternalClient", Label: "External User"},
			{ID: "llm", NodeType: "LLMNode", Label: "LLM Service"},
		},
		Edges: []Edge{
			{ID: "e1", Source: "client", Target: "llm"},
		},
	}
	auditor := NewSecurityAuditor(graph)
	violations := auditor.Audit()

	found := false
	for _, v := range violations {
		if v.Type == ViolationLLMInjection && v.SourceNodeID == "client" && v.TargetNodeID == "llm" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected llm_injection violation for external client directly accessing LLM")
	}
}

func TestLLMInjection_ProtectedByGateway_NoViolation(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "client", NodeType: "ExternalClient", Label: "External"},
			{ID: "gw", NodeType: "APIGateway", Label: "API Gateway"},
			{ID: "llm", NodeType: "LLMNode", Label: "LLM"},
		},
		Edges: []Edge{
			{ID: "e1", Source: "client", Target: "gw"},
			{ID: "e2", Source: "gw", Target: "llm"},
		},
	}
	violations := NewSecurityAuditor(graph).Audit()
	for _, v := range violations {
		if v.Type == ViolationLLMInjection {
			t.Errorf("unexpected llm_injection when gateway protects: %s", v.Message)
		}
	}
}

// Overly Permissive Inbound: non-public node with no allowed inbound rules
func TestOverlyPermissiveInboundDetection(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "app", NodeType: "AppServer", Label: "App Server", Security: SecurityConfig{IsPublicFacing: false, AllowedInbound: []string{}}},
		},
	}
	violations := NewSecurityAuditor(graph).Audit()

	found := false
	for _, v := range violations {
		if v.Type == ViolationOverlyPermissiveInbound && v.SourceNodeID == "app" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected overly_permissive_inbound for non-public node with no inbound rules")
	}
}

// Public Storage: external client reaches storage without protection
func TestPublicStorageExposureDetection(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "client", NodeType: "ExternalClient", Label: "External User"},
			{ID: "cdn", NodeType: "CDN", Label: "CDN Cache"},
		},
		Edges: []Edge{
			{ID: "e1", Source: "client", Target: "cdn"},
		},
	}
	auditor := NewSecurityAuditor(graph)
	violations := auditor.Audit()

	found := false
	for _, v := range violations {
		if v.Type == ViolationPublicStorage && v.TargetNodeID == "cdn" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected public_storage violation for CDN accessible from external client")
	}
}

// Unencrypted transit: edge that bypasses the mismatch check (RequiresTLS=true + target RequiresTLS=false)
// Note: edges with RequiresTLS=false are NOT flagged by this rule
func TestUnencryptedTransit_EdgeWithoutTLS_NotFlagged(t *testing.T) {
	// Current behavior: only flags mismatches (edge requires TLS but target doesn't support it)
	// Edges where RequiresTLS=false are not flagged as unencrypted transit
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "web", NodeType: "WebServer", Label: "Web", Security: SecurityConfig{RequiresTLS: true}},
			{ID: "db", NodeType: "PostgreSQLDB", Label: "DB", Security: SecurityConfig{RequiresTLS: true}},
		},
		Edges: []Edge{
			{ID: "e1", Source: "web", Target: "db", RequiresTLS: false},
		},
	}
	auditor := NewSecurityAuditor(graph)
	violations := auditor.Audit()

	for _, v := range violations {
		if v.Type == ViolationUnencryptedTransit {
			t.Errorf("current behavior: edge without TLS is not flagged; got unexpected violation: %s", v.Message)
		}
	}
}

// Multiple violation types detected in a single scan
func TestAudit_MultipleViolations(t *testing.T) {
	graph := InfraGraph{
		Nodes: []Node{
			{ID: "client", NodeType: "ExternalClient", Label: "External", Security: SecurityConfig{VpcID: "vpc-main"}},
			{ID: "app", NodeType: "AppServer", Label: "App Server",
				Security: SecurityConfig{VpcID: "vpc-a", IsPublicFacing: false, AllowedInbound: []string{}}},
			{ID: "db", NodeType: "PostgreSQLDB", Label: "Database",
				Security: SecurityConfig{VpcID: "vpc-main", RequiresTLS: false}},
		},
		Edges: []Edge{
			{ID: "e1", Source: "client", Target: "app", RequiresTLS: true},
			{ID: "e2", Source: "app", Target: "db", RequiresTLS: false, AuthRequired: false},
		},
	}
	violations := NewSecurityAuditor(graph).Audit()

	typeSet := make(map[ViolationType]bool)
	for _, v := range violations {
		typeSet[v.Type] = true
	}

	// Should detect public_database (client can reach DB directly)
	if !typeSet[ViolationPublicDatabase] {
		t.Error("expected public_database violation")
	}
	// Should detect overly_permissive_inbound (app has no inbound rules)
	if !typeSet[ViolationOverlyPermissiveInbound] {
		t.Error("expected overly_permissive_inbound violation")
	}
	// Should detect implicit_trust (app to db without mTLS)
	if !typeSet[ViolationImplicitTrust] {
		t.Error("expected implicit_trust violation")
	}
}
