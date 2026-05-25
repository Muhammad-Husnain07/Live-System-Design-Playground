package simulation

const (
	BootTimeTicks      = 300 // 30 seconds at 100ms tick rate per new instance
	ScaleUpThreshold   = 10.0 // trigger when CPU > TargetCPUPercent + 10%
	ScaleDownThreshold = 20.0 // trigger when CPU < TargetCPUPercent - 20%
)

func DefaultAutoScaling() AutoScaling {
	return AutoScaling{
		Enabled:          false,
		MinInstances:     1,
		MaxInstances:     10,
		TargetCPUPercent: 70,
		TargetMemPercent: 80,
		CooldownTicks:    3,
		CooldownSeconds:  60,
		ScaleUpFactor:    1.5,
		ScaleDownFactor:  0.5,
	}
}

func ApplyAutoScaling(nodeMap map[string]*Node, tickNum int) {
	for _, n := range nodeMap {
		if !n.AutoScaling.Enabled {
			n.ScalingEvent = ""
			n.DesiredInstances = n.Instances
			n.BootTicksRemaining = 0
			continue
		}
		if n.MaxRPS <= 0 || n.Instances <= 0 {
			continue
		}

		ac := n.AutoScaling
		desired := n.Instances

		cooldownTicks := ac.CooldownTicks
		if ac.CooldownSeconds > 0 && cooldownTicks <= 0 {
			cooldownTicks = ac.CooldownSeconds * 10
		}
		if cooldownTicks < 1 {
			cooldownTicks = 1
		}

		inCooldown := n.LastScaleTick > 0 && tickNum-n.LastScaleTick < cooldownTicks
		if !inCooldown {
			capacity := float64(n.Instances) * n.MaxRPS
			if capacity <= 0 {
				continue
			}
			util := n.CurrentRPS / capacity
			cpuPct := util * 100

			switch {
			case cpuPct > ac.TargetCPUPercent+ScaleUpThreshold && n.Instances < ac.MaxInstances:
				desired = n.Instances + 1
			case cpuPct < ac.TargetCPUPercent-ScaleDownThreshold && n.Instances > ac.MinInstances:
				desired = n.Instances - 1
			}

			if desired != n.Instances {
				n.LastScaleTick = tickNum
				n.DesiredInstances = desired
				if desired > n.Instances {
					n.BootTicksRemaining = BootTimeTicks
					n.LastScaleDir = "up"
					n.ScalingEvent = "scaling up"
				} else {
					n.LastScaleDir = "down"
					n.ScalingEvent = "scaling down"
					n.Instances = desired
				}
			} else {
				n.DesiredInstances = desired
				n.ScalingEvent = ""
			}
		} else {
			n.ScalingEvent = ""
		}

		// Boot phase: countdown timer; new instance does NOT contribute until boot completes
		if n.BootTicksRemaining > 0 {
			n.BootTicksRemaining--
			n.Instances = n.DesiredInstances - 1
			if n.Instances < ac.MinInstances {
				n.Instances = ac.MinInstances
			}
			if n.BootTicksRemaining == 0 {
				n.Instances = n.DesiredInstances
			}
		}
	}
}
