package simulation

import (
	"testing"
)

func TestDefaultAutoScaling(t *testing.T) {
	ac := DefaultAutoScaling()
	if ac.Enabled {
		t.Error("default should have Enabled=false")
	}
	if ac.MinInstances != 1 {
		t.Errorf("expected MinInstances=1, got %d", ac.MinInstances)
	}
	if ac.MaxInstances != 10 {
		t.Errorf("expected MaxInstances=10, got %d", ac.MaxInstances)
	}
	if ac.TargetCPUPercent != 70 {
		t.Errorf("expected TargetCPUPercent=70, got %f", ac.TargetCPUPercent)
	}
}

func TestApplyAutoScaling_ScaleUpOnHighCPU(t *testing.T) {
	nm := map[string]*Node{
		"n1": {
			ID: "n1", MaxRPS: 1000, Instances: 2, CurrentRPS: 1800,
			AutoScaling: AutoScaling{
				Enabled: true, MinInstances: 1, MaxInstances: 10,
				TargetCPUPercent: 70, CooldownTicks: 3,
			},
		},
	}
	// CPU = 1800 / (2*1000) = 0.9 → 90% > 70+10 → scale up
	ApplyAutoScaling(nm, 1)
	n := nm["n1"]
	if n.DesiredInstances != 3 {
		t.Errorf("expected scale-up to 3 instances, got DesiredInstances=%d", n.DesiredInstances)
	}
	if n.ScalingEvent != "scaling up" {
		t.Errorf("expected scaling up event, got '%s'", n.ScalingEvent)
	}
	if n.BootTicksRemaining != BootTimeTicks-1 {
		t.Errorf("expected boot time %d ticks remaining after decrement, got %d", BootTimeTicks-1, n.BootTicksRemaining)
	}
	// During boot, instances = desired - 1
	if n.Instances != 2 {
		t.Errorf("during boot, instances should be DesiredInstances-1 (2), got %d", n.Instances)
	}
}

func TestApplyAutoScaling_ScaleDownOnLowCPU(t *testing.T) {
	nm := map[string]*Node{
		"n1": {
			ID: "n1", MaxRPS: 1000, Instances: 5, CurrentRPS: 200,
			AutoScaling: AutoScaling{
				Enabled: true, MinInstances: 1, MaxInstances: 10,
				TargetCPUPercent: 70, CooldownTicks: 3,
			},
		},
	}
	// CPU = 200 / (5*1000) = 0.04 → 4% < 70-20 → scale down
	ApplyAutoScaling(nm, 1)
	n := nm["n1"]
	if n.DesiredInstances != 4 {
		t.Errorf("expected scale-down to 4 instances, got DesiredInstances=%d", n.DesiredInstances)
	}
	if n.ScalingEvent != "scaling down" {
		t.Errorf("expected scaling down event, got '%s'", n.ScalingEvent)
	}
	// Scale-down is immediate
	if n.Instances != 4 {
		t.Errorf("scale-down should be immediate, got Instances=%d", n.Instances)
	}
}

func TestApplyAutoScaling_NoScaleWithinRange(t *testing.T) {
	nm := map[string]*Node{
		"n1": {
			ID: "n1", MaxRPS: 1000, Instances: 3, CurrentRPS: 1800,
			AutoScaling: AutoScaling{
				Enabled: true, MinInstances: 1, MaxInstances: 10,
				TargetCPUPercent: 70, CooldownTicks: 3,
			},
		},
	}
	// CPU = 1800 / (3*1000) = 0.6 → 60% (between 50 and 80) → no scale
	ApplyAutoScaling(nm, 1)
	n := nm["n1"]
	if n.DesiredInstances != 3 {
		t.Errorf("expected no scale (60%% CPU in [50,80]), got DesiredInstances=%d", n.DesiredInstances)
	}
	if n.ScalingEvent != "" {
		t.Errorf("expected no scaling event, got '%s'", n.ScalingEvent)
	}
}

func TestApplyAutoScaling_BootPhaseCompletesAfter300Ticks(t *testing.T) {
	nm := map[string]*Node{
		"n1": {
			ID: "n1", MaxRPS: 1000, Instances: 2, CurrentRPS: 1800,
			AutoScaling: AutoScaling{
				Enabled: true, MinInstances: 1, MaxInstances: 10,
				TargetCPUPercent: 70, CooldownTicks: 3,
			},
		},
	}
	// Scale up
	ApplyAutoScaling(nm, 1)
	n := nm["n1"]
	startInstances := n.Instances

	// Simulate boot: remaining 299 decrements needed (300 total including the first)
	for tick := 2; tick <= 300; tick++ {
		n.CurrentRPS = 1800
		ApplyAutoScaling(nm, tick)
	}

	if n.BootTicksRemaining != 0 {
		t.Errorf("boot should be complete after 300 ticks, got remaining=%d", n.BootTicksRemaining)
	}
	if n.Instances != n.DesiredInstances {
		t.Errorf("after boot, Instances should equal DesiredInstances (%d), got %d", n.DesiredInstances, n.Instances)
	}
	if n.Instances <= startInstances {
		t.Errorf("after boot, instances should have increased from %d to %d", startInstances, n.Instances)
	}
}

func TestApplyAutoScaling_DisabledNodeIgnored(t *testing.T) {
	nm := map[string]*Node{
		"n1": {
			ID: "n1", MaxRPS: 1000, Instances: 2, CurrentRPS: 1900,
			AutoScaling: AutoScaling{Enabled: false},
		},
	}
	ApplyAutoScaling(nm, 1)
	n := nm["n1"]
	if n.DesiredInstances != 2 {
		t.Errorf("disabled auto-scaling should keep DesiredInstances=Instances, got %d", n.DesiredInstances)
	}
	if n.ScalingEvent != "" {
		t.Errorf("disabled auto-scaling should not set scaling event, got '%s'", n.ScalingEvent)
	}
}

func TestApplyAutoScaling_CooldownPreventsRapidScaling(t *testing.T) {
	nm := map[string]*Node{
		"n1": {
			ID: "n1", MaxRPS: 1000, Instances: 2, CurrentRPS: 1900,
			AutoScaling: AutoScaling{
				Enabled: true, MinInstances: 1, MaxInstances: 10,
				TargetCPUPercent: 70, CooldownTicks: 10,
			},
		},
	}
	// First tick: scale up
	ApplyAutoScaling(nm, 1)
	n := nm["n1"]
	if n.DesiredInstances != 3 {
		t.Errorf("expected scale-up on first tick, got DesiredInstances=%d", n.DesiredInstances)
	}
	// Second tick: still in cooldown, no further scaling
	n.CurrentRPS = 2000 // Even higher CPU, but cooldown active
	n.Instances = 2     // boot phase hasn't completed
	ApplyAutoScaling(nm, 2)
	if n.DesiredInstances != 3 {
		t.Errorf("expected no scaling change during cooldown, got DesiredInstances=%d", n.DesiredInstances)
	}
}

func TestApplyAutoScaling_CooldownSecondsUses10TicksPerSecond(t *testing.T) {
	nm := map[string]*Node{
		"n1": {
			ID: "n1", MaxRPS: 1000, Instances: 2, CurrentRPS: 1900,
			AutoScaling: AutoScaling{
				Enabled: true, MinInstances: 1, MaxInstances: 10,
				TargetCPUPercent: 70, CooldownTicks: 0, CooldownSeconds: 3,
			},
		},
	}
	ApplyAutoScaling(nm, 1)
	n := nm["n1"]
	if n.DesiredInstances != 3 {
		t.Errorf("expected scale-up, got DesiredInstances=%d", n.DesiredInstances)
	}
	// 3 seconds * 10 = 30 ticks cooldown; tick 5 should still be in cooldown
	n.CurrentRPS = 2000
	n.Instances = 2
	ApplyAutoScaling(nm, 5)
	if n.DesiredInstances != 3 {
		t.Errorf("expected cooldown to prevent scaling at tick 5 (30-tick cooldown), got DesiredInstances=%d", n.DesiredInstances)
	}
}

func TestApplyAutoScaling_AtMaxInstancesNoScaleUp(t *testing.T) {
	nm := map[string]*Node{
		"n1": {
			ID: "n1", MaxRPS: 1000, Instances: 10, CurrentRPS: 9500,
			AutoScaling: AutoScaling{
				Enabled: true, MinInstances: 1, MaxInstances: 10,
				TargetCPUPercent: 70, CooldownTicks: 3,
			},
		},
	}
	ApplyAutoScaling(nm, 1)
	n := nm["n1"]
	if n.DesiredInstances > 10 {
		t.Errorf("should not scale beyond MaxInstances=10, got %d", n.DesiredInstances)
	}
}

func TestApplyAutoScaling_AtMinInstancesNoScaleDown(t *testing.T) {
	nm := map[string]*Node{
		"n1": {
			ID: "n1", MaxRPS: 1000, Instances: 1, CurrentRPS: 50,
			AutoScaling: AutoScaling{
				Enabled: true, MinInstances: 1, MaxInstances: 10,
				TargetCPUPercent: 70, CooldownTicks: 3,
			},
		},
	}
	ApplyAutoScaling(nm, 1)
	n := nm["n1"]
	if n.DesiredInstances < 1 {
		t.Errorf("should not scale below MinInstances=1, got %d", n.DesiredInstances)
	}
}

func TestApplyAutoScaling_BootTicksRemainingDecrements(t *testing.T) {
	nm := map[string]*Node{
		"n1": {
			ID: "n1", MaxRPS: 1000, Instances: 2, CurrentRPS: 1800,
			AutoScaling: AutoScaling{
				Enabled: true, MinInstances: 1, MaxInstances: 10,
				TargetCPUPercent: 70, CooldownTicks: 3,
			},
		},
	}
	// Tick 1: scale up
	ApplyAutoScaling(nm, 1)
	n := nm["n1"]

	for tick := 2; tick <= 300; tick++ {
		n.CurrentRPS = 1800
		ApplyAutoScaling(nm, tick)
		if n.BootTicksRemaining < 0 {
			t.Fatalf("BootTicksRemaining went negative at tick %d", tick)
		}
	}
}
