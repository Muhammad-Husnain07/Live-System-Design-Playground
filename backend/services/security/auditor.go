package security

import (
	"encoding/json"
	"strings"
)

type Severity string

const (
	SeverityCritical Severity = "critical"
	SeverityWarning  Severity = "warning"
)

type ViolationType string

const (
	ViolationUnencryptedTransit       ViolationType = "unencrypted_transit"
	ViolationPublicDatabase           ViolationType = "public_database"
	ViolationCrossVPCUnfirewalled     ViolationType = "cross_vpc_unfirewalled"
	ViolationOverlyPermissiveInbound  ViolationType = "overly_permissive_inbound"
	ViolationPublicStorage            ViolationType = "public_storage"
	ViolationSSRF                     ViolationType = "ssrf_vector"
	ViolationIAMPrivilegeEscalation   ViolationType = "iam_privilege_escalation"
	ViolationMissingAuth              ViolationType = "missing_authentication"
	ViolationImplicitTrust            ViolationType = "implicit_trust"
	ViolationPublicSecret             ViolationType = "public_secret"
	ViolationLLMInjection             ViolationType = "llm_injection"
)

type SecurityViolation struct {
	Severity     Severity      `json:"severity"`
	Type         ViolationType `json:"type"`
	SourceNodeID string        `json:"sourceNodeId"`
	TargetNodeID string        `json:"targetNodeId"`
	Message      string        `json:"message"`
	Remediation  string        `json:"remediation,omitempty"`
}

type SecurityConfig struct {
	IsPublicFacing bool     `json:"isPublicFacing"`
	RequiresTLS    bool     `json:"requiresTLS"`
	AllowedInbound []string `json:"allowedInbound"`
	VpcID          string   `json:"vpcId"`
}

type Node struct {
	ID          string
	NodeType    string
	Label       string
	Security    SecurityConfig
	Permissions string
}

type Edge struct {
	ID           string
	Source       string
	Target       string
	RequiresTLS  bool
	AuthRequired bool
}

type InfraGraph struct {
	Nodes []Node
	Edges []Edge
}

type SecurityAuditor struct {
	graph InfraGraph
}

func NewSecurityAuditor(graph InfraGraph) *SecurityAuditor {
	return &SecurityAuditor{graph: graph}
}

func (a *SecurityAuditor) Audit() []SecurityViolation {
	var violations []SecurityViolation
	violations = append(violations, a.checkUnencryptedTransit()...)
	violations = append(violations, a.checkPublicDatabase()...)
	violations = append(violations, a.checkCrossVPCUnfirewalled()...)
	violations = append(violations, a.checkOverlyPermissiveInbound()...)
	violations = append(violations, a.checkPublicStorageExposure()...)
	violations = append(violations, a.checkSSRFVectors()...)
	violations = append(violations, a.checkIAMPrivilegeEscalation()...)
	violations = append(violations, a.checkMissingAuthentication()...)
	violations = append(violations, a.checkImplicitTrust()...)
	violations = append(violations, a.checkPublicSecret()...)
	violations = append(violations, a.checkLLMInjection()...)
	if violations == nil {
		return []SecurityViolation{}
	}
	return violations
}

/* ── helpers ── */

func (a *SecurityAuditor) nodeByID(id string) *Node {
	for i := range a.graph.Nodes {
		if a.graph.Nodes[i].ID == id {
			return &a.graph.Nodes[i]
		}
	}
	return nil
}

func isDataType(nt string) bool {
	switch nt {
	case "PostgreSQLDB", "MySQLDB", "MongoDB", "Redis", "Elasticsearch":
		return true
	}
	return false
}

func isExternalType(nt string) bool {
	switch nt {
	case "ExternalClient", "MobileClient", "WebBrowser", "ThirdPartyAPI":
		return true
	}
	return false
}

func isProtectiveType(nt string) bool {
	switch nt {
	case "Firewall", "LoadBalancer", "APIGateway":
		return true
	}
	return false
}

func isServerlessType(nt string) bool {
	return nt == "ServerlessFunction" || nt == "ServerlessV2" || nt == "EdgeCompute"
}

func isLLMType(nt string) bool {
	return nt == "LLMNode"
}

func isComputeType(nt string) bool {
	switch nt {
	case "AppServer", "Microservice", "WebServer", "WorkerService", "ServerlessFunction":
		return true
	}
	return false
}

func isStorageType(nt string) bool {
	return nt == "S3" || nt == "CDN" || isDataType(nt)
}

func (a *SecurityAuditor) hasUnprotectedPath(from, to string) bool {
	type entry struct {
		nodeID string
	}
	visited := map[string]bool{from: true}
	queue := []entry{{nodeID: from}}
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		for _, e := range a.graph.Edges {
			if e.Source != cur.nodeID || visited[e.Target] {
				continue
			}
			if e.Target == to {
				return true
			}
			visited[e.Target] = true
			n := a.nodeByID(e.Target)
			if n == nil || isProtectiveType(n.NodeType) {
				continue
			}
			queue = append(queue, entry{nodeID: e.Target})
		}
	}
	return false
}

func (a *SecurityAuditor) outboundNodeIDs(nodeID string) []string {
	var out []string
	visited := map[string]bool{nodeID: true}
	type entry struct{ id string }
	queue := []entry{{id: nodeID}}
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		for _, e := range a.graph.Edges {
			if e.Source != cur.id || visited[e.Target] {
				continue
			}
			visited[e.Target] = true
			out = append(out, e.Target)
			queue = append(queue, entry{id: e.Target})
		}
	}
	return out
}

func (a *SecurityAuditor) inboundFromExternal(nodeID string) bool {
	for _, e := range a.graph.Edges {
		if e.Target != nodeID {
			continue
		}
		src := a.nodeByID(e.Source)
		if src == nil {
			continue
		}
		if isExternalType(src.NodeType) {
			return true
		}
	}
	return false
}

/* ── Rule 1: Unencrypted Transit ── */

func (a *SecurityAuditor) checkUnencryptedTransit() []SecurityViolation {
	var out []SecurityViolation
	for _, e := range a.graph.Edges {
		if !e.RequiresTLS {
			continue
		}
		target := a.nodeByID(e.Target)
		if target == nil || target.Security.RequiresTLS {
			continue
		}
		out = append(out, SecurityViolation{
			Severity:     SeverityCritical,
			Type:         ViolationUnencryptedTransit,
			SourceNodeID: e.Source,
			TargetNodeID: e.Target,
			Message:      "Edge requires TLS but target node " + target.Label + " has TLS disabled. Traffic may be sent in plaintext despite the requirement.",
			Remediation:  "Enable TLS on the target node or use AWS Certificate Manager / Azure Key Vault to terminate TLS at the load balancer.",
		})
	}
	return out
}

/* ── Rule 2: Public Database ── */

func (a *SecurityAuditor) checkPublicDatabase() []SecurityViolation {
	var out []SecurityViolation
	for _, dn := range a.graph.Nodes {
		if !isDataType(dn.NodeType) || dn.Security.VpcID == "" {
			continue
		}
		for _, en := range a.graph.Nodes {
			if !isExternalType(en.NodeType) || en.Security.VpcID != dn.Security.VpcID {
				continue
			}
			if a.hasUnprotectedPath(en.ID, dn.ID) {
				out = append(out, SecurityViolation{
					Severity:     SeverityCritical,
					Type:         ViolationPublicDatabase,
					SourceNodeID: en.ID,
					TargetNodeID: dn.ID,
					Message:      en.Label + " can reach " + dn.Label + " (" + string(dn.NodeType) + ") without a firewall or load balancer — data store is exposed to external traffic",
					Remediation:  "Place the database in a private subnet with a security group that only allows inbound traffic from the app tier. Use AWS RDS Proxy or Azure Private Link.",
				})
			}
		}
	}
	return out
}

/* ── Rule 3: Cross-VPC Unfirewalled ── */

func (a *SecurityAuditor) checkCrossVPCUnfirewalled() []SecurityViolation {
	var out []SecurityViolation
	for _, e := range a.graph.Edges {
		src := a.nodeByID(e.Source)
		tgt := a.nodeByID(e.Target)
		if src == nil || tgt == nil {
			continue
		}
		if src.Security.VpcID == "" || tgt.Security.VpcID == "" || src.Security.VpcID == tgt.Security.VpcID {
			continue
		}
		if isProtectiveType(src.NodeType) || isProtectiveType(tgt.NodeType) {
			continue
		}
		out = append(out, SecurityViolation{
			Severity:     SeverityWarning,
			Type:         ViolationCrossVPCUnfirewalled,
			SourceNodeID: e.Source,
			TargetNodeID: e.Target,
			Message:      src.Label + " (VPC: " + shortVPCID(src.Security.VpcID) + ") connects to " + tgt.Label + " (VPC: " + shortVPCID(tgt.Security.VpcID) + ") without a firewall — cross-VPC traffic is unfiltered",
			Remediation:  "Use VPC Peering or AWS Transit Gateway with explicit route tables. Apply network ACLs and security group rules to both VPCs. For Azure, use VNet peering with NSG rules.",
		})
	}
	return out
}

/* ── Rule 4: Overly Permissive Inbound ── */

func (a *SecurityAuditor) checkOverlyPermissiveInbound() []SecurityViolation {
	var out []SecurityViolation
	for _, n := range a.graph.Nodes {
		if n.Security.IsPublicFacing {
			continue
		}
		if len(n.Security.AllowedInbound) == 0 {
			out = append(out, SecurityViolation{
				Severity:     SeverityWarning,
				Type:         ViolationOverlyPermissiveInbound,
				SourceNodeID: n.ID,
				TargetNodeID: n.ID,
				Message:      n.Label + " has no allowed inbound sources and is not public facing — it may be unreachable or overly permissive by default",
				Remediation:  "Define explicit inbound rules in the security group. For AWS, use security group ingress rules. For Azure, use NSG inbound rules with specific source IP ranges or service tags.",
			})
		}
	}
	return out
}

/* ── Rule 5: Public Storage Exposure ── */

func (a *SecurityAuditor) checkPublicStorageExposure() []SecurityViolation {
	var out []SecurityViolation
	for _, n := range a.graph.Nodes {
		if !isStorageType(n.NodeType) {
			continue
		}
		// Storage is public if an ExternalClient can reach it without a protective node in between
		for _, en := range a.graph.Nodes {
			if !isExternalType(en.NodeType) {
				continue
			}
			if a.hasUnprotectedPath(en.ID, n.ID) {
				out = append(out, SecurityViolation{
					Severity:     SeverityCritical,
					Type:         ViolationPublicStorage,
					SourceNodeID: en.ID,
					TargetNodeID: n.ID,
					Message:      n.Label + " (" + n.NodeType + ") is directly accessible by " + en.Label + " without a Firewall, VPC boundary, or Auth node — data store is publicly exposed.",
					Remediation:  "Use AWS S3 Block Public Access / Azure Storage firewall. Place the data store behind a VPC with a NAT gateway. Require signed URLs or IAM-based access (e.g., presigned S3 URLs, Azure SAS tokens).",
				})
			}
		}
	}
	return out
}

/* ── Rule 6: SSRF Vectors ── */

func (a *SecurityAuditor) checkSSRFVectors() []SecurityViolation {
	var out []SecurityViolation
	for _, n := range a.graph.Nodes {
		if !isComputeType(n.NodeType) {
			continue
		}
		// Check if node accepts inbound from external clients
		acceptsExternal := a.inboundFromExternal(n.ID)
		if !acceptsExternal {
			continue
		}
		// Check if node has outbound connections to internal databases or metadata endpoints
		outboundIDs := a.outboundNodeIDs(n.ID)
		hasInternalDB := false
		for _, oid := range outboundIDs {
			on := a.nodeByID(oid)
			if on == nil {
				continue
			}
			if isDataType(on.NodeType) || on.NodeType == "VPC" || on.NodeType == "Subnet" {
				hasInternalDB = true
				break
			}
		}
		if !hasInternalDB {
			continue
		}
		// Check if there's an API Gateway or strict VPC routing protecting the path
		protected := false
		for _, e := range a.graph.Edges {
			if e.Source != n.ID {
				continue
			}
			tgt := a.nodeByID(e.Target)
			if tgt == nil {
				continue
			}
			if tgt.NodeType == "APIGateway" || tgt.NodeType == "Firewall" || tgt.NodeType == "LoadBalancer" {
				protected = true
				break
			}
		}
		if protected {
			continue
		}
		out = append(out, SecurityViolation{
			Severity:     SeverityWarning,
			Type:         ViolationSSRF,
			SourceNodeID: n.ID,
			TargetNodeID: n.ID,
			Message:      n.Label + " (" + n.NodeType + ") accepts connections from external clients AND has outbound access to internal databases — potential SSRF vector to internal metadata endpoint (169.254.169.254).",
			Remediation:  "Use AWS IMDSv2 (disable IMDSv1) / Azure Managed Identity instead of access keys. Add an API Gateway in front of the compute node to validate and sanitize all external inputs. Apply strict egress network policies (e.g., AWS VPC endpoints, Azure Service Endpoints).",
		})
	}
	return out
}

/* ── Rule 7: IAM Privilege Escalation ── */

func (a *SecurityAuditor) checkIAMPrivilegeEscalation() []SecurityViolation {
	var out []SecurityViolation
	for _, n := range a.graph.Nodes {
		if n.Permissions == "" {
			continue
		}
		isAdmin := strings.Contains(n.Permissions, "Admin") || strings.Contains(n.Permissions, "*") || strings.Contains(n.Permissions, "admin")
		if !isAdmin {
			continue
		}
		// Check if a lower-tier service can reach this admin-level node
		for _, e := range a.graph.Edges {
			if e.Target != n.ID {
				continue
			}
			src := a.nodeByID(e.Source)
			if src == nil {
				continue
			}
			if src.NodeType == "WorkerService" || src.NodeType == "Microservice" || src.NodeType == "WebServer" {
				out = append(out, SecurityViolation{
					Severity:     SeverityCritical,
					Type:         ViolationIAMPrivilegeEscalation,
					SourceNodeID: src.ID,
					TargetNodeID: n.ID,
					Message:      src.Label + " (" + src.NodeType + ") has direct access to " + n.Label + " which has admin-level permissions (" + n.Permissions + ") — over-privileged service account allows privilege escalation.",
					Remediation:  "Apply the principle of least privilege. Use AWS IAM Roles for Service Accounts (IRSA) or Azure AD Pod Managed Identities. Grant only the specific actions needed (e.g., s3:GetObject instead of s3:*). Use AWS IAM Access Analyzer to identify overly permissive policies.",
				})
			}
		}
	}
	return out
}

/* ── Rule 8: Missing Authentication ── */

func (a *SecurityAuditor) checkMissingAuthentication() []SecurityViolation {
	var out []SecurityViolation
	for _, e := range a.graph.Edges {
		src := a.nodeByID(e.Source)
		tgt := a.nodeByID(e.Target)
		if src == nil || tgt == nil {
			continue
		}
		// Only flag edges from APIGateway/LoadBalancer to Microservice/AppServer/WebServer
		if src.NodeType != "APIGateway" && src.NodeType != "LoadBalancer" {
			continue
		}
		if !isComputeType(tgt.NodeType) {
			continue
		}
		if e.AuthRequired {
			continue
		}
		out = append(out, SecurityViolation{
			Severity:     SeverityWarning,
			Type:         ViolationMissingAuth,
			SourceNodeID: e.Source,
			TargetNodeID: e.Target,
			Message:      src.Label + " routes to " + tgt.Label + " without authentication — internal API endpoint is unauthenticated and accessible to anyone who reaches the gateway.",
			Remediation:  "Enable auth on the edge or gateway. Use AWS Cognito / Azure AD B2C for API auth. For internal APIs, use API Gateway Lambda authorizers or JWT validation. Add AWS WAF or Azure Front Door WAF policies to block unauthenticated requests.",
		})
	}
	return out
}

/* ── Rule 9: Implicit Trust (Zero Trust) ── */

func (a *SecurityAuditor) checkImplicitTrust() []SecurityViolation {
	var out []SecurityViolation
	// Zero Trust Principle: no internal node should implicitly trust another.
	// If two internal (non-external) nodes communicate without mTLS (RequiresTLS)
	// and without an identity provider (AuthRequired), flag as implicit trust.
	for _, e := range a.graph.Edges {
		src := a.nodeByID(e.Source)
		tgt := a.nodeByID(e.Target)
		if src == nil || tgt == nil {
			continue
		}
		// Skip edges involving external clients — those are expected to be untrusted
		if isExternalType(src.NodeType) || isExternalType(tgt.NodeType) {
			continue
		}
		// Skip protective infrastructure that terminates trust
		if isProtectiveType(src.NodeType) || isProtectiveType(tgt.NodeType) {
			continue
		}
		if e.RequiresTLS && e.AuthRequired {
			continue
		}
		out = append(out, SecurityViolation{
			Severity:     SeverityCritical,
			Type:         ViolationImplicitTrust,
			SourceNodeID: e.Source,
			TargetNodeID: e.Target,
			Message:      src.Label + " connects to " + tgt.Label + " without mTLS or identity-aware auth — implicit trust violates Zero Trust principles. Internal nodes must authenticate every request.",
			Remediation:  "Enable mTLS between all internal services using a service mesh (Istio/Linkerd) or enable AuthRequired on the edge. Use SPIFFE/SPIRE for workload identity. For AWS, use App Mesh with mTLS. For Azure, use Azure AD Workload Identity.",
		})
	}
	return out
}

/* ── Rule 10: Public Secrets (Zero Trust) ── */

func (a *SecurityAuditor) checkPublicSecret() []SecurityViolation {
	var out []SecurityViolation
	// Serverless/Edge nodes that are public-facing must not be configured
	// with inline secrets (detected via Permissions field containing sensitive keywords).
	for _, n := range a.graph.Nodes {
		if !isServerlessType(n.NodeType) {
			continue
		}
		if !n.Security.IsPublicFacing {
			continue
		}
		if n.Permissions == "" {
			continue
		}
		hasSecret := strings.Contains(n.Permissions, "secret") ||
			strings.Contains(n.Permissions, "password") ||
			strings.Contains(n.Permissions, "token") ||
			strings.Contains(n.Permissions, "api_key") ||
			strings.Contains(n.Permissions, "access_key") ||
			strings.Contains(n.Permissions, "credential")
		if !hasSecret {
			continue
		}
		out = append(out, SecurityViolation{
			Severity:     SeverityCritical,
			Type:         ViolationPublicSecret,
			SourceNodeID: n.ID,
			TargetNodeID: n.ID,
			Message:      n.Label + " (" + n.NodeType + ") is public-facing and contains inline secrets in its configuration — exposed to credential exfiltration via env vars or config maps.",
			Remediation:  "Use a secrets manager (AWS Secrets Manager / Azure Key Vault) to inject secrets at runtime via environment variables. Never bake secrets into function code or config maps. Enable encryption at rest for the secrets store.",
		})
	}
	return out
}

/* ── Rule 11: LLM Injection (Zero Trust) ── */

func (a *SecurityAuditor) checkLLMInjection() []SecurityViolation {
	var out []SecurityViolation
	// LLM nodes must not be directly reachable from ExternalClient nodes
	// without a sanitizing gateway (APIGateway or Firewall) in between.
	for _, n := range a.graph.Nodes {
		if !isLLMType(n.NodeType) {
			continue
		}
		for _, en := range a.graph.Nodes {
			if !isExternalType(en.NodeType) {
				continue
			}
			if a.hasUnprotectedPath(en.ID, n.ID) {
				out = append(out, SecurityViolation{
					Severity:     SeverityCritical,
					Type:         ViolationLLMInjection,
					SourceNodeID: en.ID,
					TargetNodeID: n.ID,
					Message:      en.Label + " has direct access to " + n.Label + " (" + n.NodeType + ") without a sanitizing gateway — prompt injection / jailbreak vector. LLM endpoints must validate and sanitize all external inputs.",
					Remediation:  "Place an API Gateway or Firewall in front of the LLM endpoint to validate input schemas, implement rate limiting, and detect prompt injection patterns (e.g., AWS WAF with ML-based rules, Azure AI Content Safety). Use a dedicated LLM proxy for input sanitization.",
				})
			}
		}
	}
	return out
}

/* ── canvas data JSON parsing ── */

type flatNode struct {
	ID   string       `json:"id"`
	Data flatNodeData `json:"data"`
}

type flatNodeData struct {
	NodeType string     `json:"nodeType"`
	Label    string     `json:"label"`
	Config   flatConfig `json:"config"`
}

type flatConfig struct {
	Security    SecurityConfig `json:"security"`
	Permissions string         `json:"permissions"`
}

type flatEdge struct {
	ID     string       `json:"id"`
	Source string       `json:"source"`
	Target string       `json:"target"`
	Data   flatEdgeData `json:"data"`
}

type flatEdgeData struct {
	Routing flatRouting `json:"routing"`
}

type flatRouting struct {
	RequiresTLS  bool `json:"requiresTLS"`
	AuthRequired bool `json:"authRequired"`
}

type flatCanvas struct {
	Nodes []flatNode `json:"nodes"`
	Edges []flatEdge `json:"edges"`
}

func ParseCanvasData(raw []byte) (InfraGraph, error) {
	var fc flatCanvas
	if err := json.Unmarshal(raw, &fc); err != nil {
		return InfraGraph{}, err
	}

	nodes := make([]Node, 0, len(fc.Nodes))
	for _, fn := range fc.Nodes {
		nodes = append(nodes, Node{
			ID:          fn.ID,
			NodeType:    fn.Data.NodeType,
			Label:       fn.Data.Label,
			Security:    fn.Data.Config.Security,
			Permissions: fn.Data.Config.Permissions,
		})
	}

	edges := make([]Edge, 0, len(fc.Edges))
	for _, fe := range fc.Edges {
		edges = append(edges, Edge{
			ID:           fe.ID,
			Source:       fe.Source,
			Target:       fe.Target,
			RequiresTLS:  fe.Data.Routing.RequiresTLS,
			AuthRequired: fe.Data.Routing.AuthRequired,
		})
	}

	return InfraGraph{Nodes: nodes, Edges: edges}, nil
}

func shortVPCID(vpcID string) string {
	parts := strings.Split(vpcID, "-")
	if len(parts) > 0 {
		last := parts[len(parts)-1]
		if len(last) > 8 {
			return last[:8]
		}
		return last
	}
	if len(vpcID) > 8 {
		return vpcID[:8]
	}
	return vpcID
}
