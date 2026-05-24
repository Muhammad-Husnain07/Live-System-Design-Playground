package simulation

import "math"

// DefaultAutoScaling returns sensible default auto-scaling parameters.
func DefaultAutoScaling() AutoScaling {
	return AutoScaling{
		Enabled:          false,
		MinInstances:     1,
		MaxInstances:     10,
		TargetCPUPercent: 70,
		TargetMemPercent: 80,
		CooldownTicks:    3,
		ScaleUpFactor:    1.5,
		ScaleDownFactor:  0.5,
	}
}

// ApplyAutoScaling evaluates each node's CPU/memory utilization and
// adjusts instance counts when thresholds are breached. Runs after
// UtilizationMetrics so CPUPercent and MemoryPercent are current.
func ApplyAutoScaling(nodeMap map[string]*Node, tickNum int) {
	for _, n := range nodeMap {
		if !n.AutoScaling.Enabled {
			n.ScalingEvent = ""
			n.DesiredInstances = n.Instances
			continue
		}
		if n.MaxRPS <= 0 || n.Instances <= 0 {
			continue
		}

		ac := n.AutoScaling
		desired := n.Instances

		// Cooldown check
		if n.LastScaleTick > 0 && tickNum-n.LastScaleTick < ac.CooldownTicks {
			n.DesiredInstances = desired
			n.ScalingEvent = ""
			continue
		}

		capacity := float64(n.Instances) * n.MaxRPS
		if capacity <= 0 {
			continue
		}
		util := n.CurrentRPS / capacity

		needsScaleUp := util*100 > ac.TargetCPUPercent || n.MemoryPercent > ac.TargetMemPercent
		needsScaleDown := util*100 < ac.TargetCPUPercent*0.6 && n.MemoryPercent < ac.TargetMemPercent*0.6

		switch {
		case needsScaleUp:
			desired = int(math.Ceil(float64(n.Instances) * ac.ScaleUpFactor))
			if desired > ac.MaxInstances {
				desired = ac.MaxInstances
			}
		case needsScaleDown && n.Instances > ac.MinInstances:
			desired = int(math.Floor(float64(n.Instances) * ac.ScaleDownFactor))
			if desired < ac.MinInstances {
				desired = ac.MinInstances
			}
		}

		if desired != n.Instances {
			event := ""
			switch {
			case desired > n.Instances:
				event = "scaling up"
			case desired < n.Instances:
				event = "scaling down"
			}
			n.LastScaleTick = tickNum
			n.DesiredInstances = desired
			n.Instances = desired
			n.ScalingEvent = event
		} else {
			n.DesiredInstances = desired
			n.ScalingEvent = ""
		}
	}
}
