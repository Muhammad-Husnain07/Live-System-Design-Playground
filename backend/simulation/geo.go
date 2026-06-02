package simulation

// Inter-region one-way latencies in milliseconds.
// Source regions are the first key, target regions the second key.
var RegionLatencyMatrix = map[string]map[string]float64{
	"us-east-1": {
		"us-east-1":      0,
		"us-west-2":      80,
		"eu-west-1":      90,
		"eu-central-1":   100,
		"ap-southeast-1": 180,
		"ap-northeast-1": 160,
		"ap-south-1":     200,
		"sa-east-1":      150,
	},
	"us-west-2": {
		"us-east-1":      80,
		"us-west-2":      0,
		"eu-west-1":      140,
		"eu-central-1":   160,
		"ap-southeast-1": 150,
		"ap-northeast-1": 120,
		"ap-south-1":     220,
		"sa-east-1":      180,
	},
	"eu-west-1": {
		"us-east-1":      90,
		"us-west-2":      140,
		"eu-west-1":      0,
		"eu-central-1":   30,
		"ap-southeast-1": 160,
		"ap-northeast-1": 240,
		"ap-south-1":     120,
		"sa-east-1":      200,
	},
	"eu-central-1": {
		"us-east-1":      100,
		"us-west-2":      160,
		"eu-west-1":      30,
		"eu-central-1":   0,
		"ap-southeast-1": 170,
		"ap-northeast-1": 250,
		"ap-south-1":     110,
		"sa-east-1":      210,
	},
	"ap-southeast-1": {
		"us-east-1":      180,
		"us-west-2":      150,
		"eu-west-1":      160,
		"eu-central-1":   170,
		"ap-southeast-1": 0,
		"ap-northeast-1": 70,
		"ap-south-1":     80,
		"sa-east-1":      320,
	},
	"ap-northeast-1": {
		"us-east-1":      160,
		"us-west-2":      120,
		"eu-west-1":      240,
		"eu-central-1":   250,
		"ap-southeast-1": 70,
		"ap-northeast-1": 0,
		"ap-south-1":     130,
		"sa-east-1":      280,
	},
	"ap-south-1": {
		"us-east-1":      200,
		"us-west-2":      220,
		"eu-west-1":      120,
		"eu-central-1":   110,
		"ap-southeast-1": 80,
		"ap-northeast-1": 130,
		"ap-south-1":     0,
		"sa-east-1":      260,
	},
	"sa-east-1": {
		"us-east-1":      150,
		"us-west-2":      180,
		"eu-west-1":      200,
		"eu-central-1":   210,
		"ap-southeast-1": 320,
		"ap-northeast-1": 280,
		"ap-south-1":     260,
		"sa-east-1":      0,
	},
}

// DNSFailoverDelayTicks is the number of ticks to wait before DNS
// propagation redirects traffic to a replica in another region.
const DNSFailoverDelayTicks = 5

// GetInterRegionLatency returns the one-way latency in milliseconds
// between two regions. Returns 0 for same region or unknown regions.
func GetInterRegionLatency(sourceRegion, targetRegion string) float64 {
	if sourceRegion == "" || targetRegion == "" || sourceRegion == targetRegion {
		return 0
	}
	if destMap, ok := RegionLatencyMatrix[sourceRegion]; ok {
		if lat, ok := destMap[targetRegion]; ok {
			return lat
		}
	}
	// Fallback for unknown regions: use average inter-region latency
	return 120
}

// FindReplicaInOtherRegion looks for a node of the same NodeType in a different
// region from the given failed node. Returns the replica node ID and its region.
// If multiple replicas exist, the first one found is returned.
func FindReplicaInOtherRegion(nodes map[string]*Node, failedNodeID string) (replicaID string, replicaRegion string) {
	failed, ok := nodes[failedNodeID]
	if !ok || failed.Region == "" {
		return "", ""
	}
	for _, n := range nodes {
		if n.ID != failedNodeID && n.NodeType == failed.NodeType && n.Region != failed.Region && n.Region != "" {
			return n.ID, n.Region
		}
	}
	return "", ""
}
