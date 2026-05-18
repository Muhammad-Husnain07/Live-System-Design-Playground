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
	ViolationUnencryptedTransit      ViolationType = "unencrypted_transit"
	ViolationPublicDatabase          ViolationType = "public_database"
	ViolationCrossVPCUnfirewalled    ViolationType = "cross_vpc_unfirewalled"
	ViolationOverlyPermissiveInbound ViolationType = "overly_permissive_inbound"
)

type SecurityViolation struct {
	Severity     Severity      `json:"severity"`
	Type         ViolationType `json:"type"`
	SourceNodeID string        `json:"sourceNodeId"`
	TargetNodeID string        `json:"targetNodeId"`
	Message      string        `json:"message"`
}

type SecurityConfig struct {
	IsPublicFacing bool     `json:"isPublicFacing"`
	RequiresTLS    bool     `json:"requiresTLS"`
	AllowedInbound []string `json:"allowedInbound"`
	VpcID          string   `json:"vpcId"`
}

type Node struct {
	ID       string
	NodeType string
	Label    string
	Security SecurityConfig
}

type Edge struct {
	ID          string
	Source      string
	Target      string
	RequiresTLS bool
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
					Message: en.Label + " can reach " + dn.Label + " (" + string(dn.NodeType) + ") without a firewall or load balancer — data store is exposed to external traffic",
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
			Message: src.Label + " (VPC: " + shortVPCID(src.Security.VpcID) + ") connects to " + tgt.Label + " (VPC: " + shortVPCID(tgt.Security.VpcID) + ") without a firewall — cross-VPC traffic is unfiltered",
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
				Message: n.Label + " has no allowed inbound sources and is not public facing — it may be unreachable or overly permissive by default",
			})
		}
	}
	return out
}

/* ── canvas data JSON parsing ── */

type flatNode struct {
	ID   string         `json:"id"`
	Data flatNodeData   `json:"data"`
}

type flatNodeData struct {
	NodeType string       `json:"nodeType"`
	Label    string       `json:"label"`
	Config   flatConfig   `json:"config"`
}

type flatConfig struct {
	Security SecurityConfig `json:"security"`
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
	RequiresTLS bool `json:"requiresTLS"`
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
			ID:       fn.ID,
			NodeType: fn.Data.NodeType,
			Label:    fn.Data.Label,
			Security: fn.Data.Config.Security,
		})
	}

	edges := make([]Edge, 0, len(fc.Edges))
	for _, fe := range fc.Edges {
		edges = append(edges, Edge{
			ID:          fe.ID,
			Source:      fe.Source,
			Target:      fe.Target,
			RequiresTLS: fe.Data.Routing.RequiresTLS,
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
