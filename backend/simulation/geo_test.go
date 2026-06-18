package simulation

import (
	"testing"
)

func TestGetInterRegionLatency_KnownPair(t *testing.T) {
	lat := GetInterRegionLatency("us-east-1", "eu-west-1")
	if lat != 90 {
		t.Errorf("us-east-1 -> eu-west-1: expected 90ms, got %.1fms", lat)
	}
}

func TestGetInterRegionLatency_SameRegion(t *testing.T) {
	lat := GetInterRegionLatency("us-east-1", "us-east-1")
	if lat != 0 {
		t.Errorf("same region: expected 0ms, got %.1fms", lat)
	}
}

func TestGetInterRegionLatency_UnknownSource(t *testing.T) {
	lat := GetInterRegionLatency("mars-1", "us-east-1")
	if lat != 120 {
		t.Errorf("unknown source: expected 120ms fallback, got %.1fms", lat)
	}
}

func TestGetInterRegionLatency_UnknownTarget(t *testing.T) {
	lat := GetInterRegionLatency("us-east-1", "mars-1")
	if lat != 120 {
		t.Errorf("unknown target: expected 120ms fallback, got %.1fms", lat)
	}
}

func TestGetInterRegionLatency_EmptySource(t *testing.T) {
	lat := GetInterRegionLatency("", "us-east-1")
	if lat != 0 {
		t.Errorf("empty source: expected 0ms, got %.1fms", lat)
	}
}

func TestGetInterRegionLatency_EmptyTarget(t *testing.T) {
	lat := GetInterRegionLatency("us-east-1", "")
	if lat != 0 {
		t.Errorf("empty target: expected 0ms, got %.1fms", lat)
	}
}

func TestGetInterRegionLatency_AllKnownPairs(t *testing.T) {
	tests := []struct {
		src, tgt string
		want     float64
	}{
		{"us-east-1", "us-west-2", 80},
		{"us-east-1", "ap-southeast-1", 180},
		{"us-west-2", "ap-northeast-1", 120},
		{"eu-west-1", "eu-central-1", 30},
		{"eu-central-1", "ap-south-1", 110},
		{"ap-southeast-1", "ap-northeast-1", 70},
		{"ap-northeast-1", "ap-southeast-1", 70},
		{"ap-south-1", "sa-east-1", 260},
		{"sa-east-1", "us-east-1", 150},
	}
	for _, tt := range tests {
		got := GetInterRegionLatency(tt.src, tt.tgt)
		if got != tt.want {
			t.Errorf("%s -> %s: expected %.1fms, got %.1fms", tt.src, tt.tgt, tt.want, got)
		}
	}
}

func TestFindReplicaInOtherRegion_Valid(t *testing.T) {
	nodes := map[string]*Node{
		"web-us": {ID: "web-us", NodeType: "WebServer", Region: "us-east-1"},
		"web-eu": {ID: "web-eu", NodeType: "WebServer", Region: "eu-west-1"},
		"db-us":  {ID: "db-us", NodeType: "PostgreSQLDB", Region: "us-east-1"},
	}
	id, region := FindReplicaInOtherRegion(nodes, "web-us")
	if id != "web-eu" {
		t.Errorf("expected replica web-eu, got %s", id)
	}
	if region != "eu-west-1" {
		t.Errorf("expected region eu-west-1, got %s", region)
	}
}

func TestFindReplicaInOtherRegion_NoReplica(t *testing.T) {
	nodes := map[string]*Node{
		"web-us": {ID: "web-us", NodeType: "WebServer", Region: "us-east-1"},
		"db-us":  {ID: "db-us", NodeType: "PostgreSQLDB", Region: "us-east-1"},
	}
	id, region := FindReplicaInOtherRegion(nodes, "web-us")
	if id != "" || region != "" {
		t.Errorf("expected empty when no replica, got id=%s region=%s", id, region)
	}
}

func TestFindReplicaInOtherRegion_SameRegionOnly(t *testing.T) {
	nodes := map[string]*Node{
		"web-us-1": {ID: "web-us-1", NodeType: "WebServer", Region: "us-east-1"},
		"web-us-2": {ID: "web-us-2", NodeType: "WebServer", Region: "us-east-1"},
	}
	id, region := FindReplicaInOtherRegion(nodes, "web-us-1")
	if id != "" || region != "" {
		t.Errorf("expected empty (same region), got id=%s region=%s", id, region)
	}
}

func TestFindReplicaInOtherRegion_NodeNotFound(t *testing.T) {
	nodes := map[string]*Node{
		"web-us": {ID: "web-us", NodeType: "WebServer", Region: "us-east-1"},
	}
	id, region := FindReplicaInOtherRegion(nodes, "nonexistent")
	if id != "" || region != "" {
		t.Errorf("expected empty for nonexistent, got id=%s region=%s", id, region)
	}
}

func TestFindReplicaInOtherRegion_NoRegion(t *testing.T) {
	nodes := map[string]*Node{
		"web-us": {ID: "web-us", NodeType: "WebServer", Region: ""},
		"web-eu": {ID: "web-eu", NodeType: "WebServer", Region: "eu-west-1"},
	}
	id, region := FindReplicaInOtherRegion(nodes, "web-us")
	if id != "" || region != "" {
		t.Errorf("expected empty when failed node has no region, got id=%s region=%s", id, region)
	}
}

func TestRegionLatencyMatrix_Complete(t *testing.T) {
	regions := []string{"us-east-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-southeast-1", "ap-northeast-1", "ap-south-1", "sa-east-1"}
	for _, src := range regions {
		destMap, ok := RegionLatencyMatrix[src]
		if !ok {
			t.Errorf("missing source region %s", src)
			continue
		}
		for _, tgt := range regions {
			_, ok := destMap[tgt]
			if !ok {
				t.Errorf("missing latency from %s to %s", src, tgt)
			}
		}
	}
}
