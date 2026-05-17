package simulation

import (
	"math"
	"math/rand"
)

type LoadGenerator struct {
	pattern TrafficPattern
	baseRPS float64
	rng     *rand.Rand
}

func NewLoadGenerator(pattern TrafficPattern, baseRPS float64) *LoadGenerator {
	return &LoadGenerator{
		pattern: pattern,
		baseRPS: baseRPS,
		rng:     rand.New(rand.NewSource(rand.Int63())),
	}
}

func (lg *LoadGenerator) RPSAtTick(tick, totalTicks int) float64 {
	var rps float64
	switch lg.pattern {
	case TrafficRampUp:
		progress := float64(tick) / float64(totalTicks)
		rps = lg.baseRPS * (0.3 + 0.7*progress)
	case TrafficSpike:
		spikeInterval := 10
		if totalTicks > 0 {
			spikeInterval = totalTicks / 5
			if spikeInterval < 5 {
				spikeInterval = 5
			}
		}
		if tick > 0 && tick%spikeInterval == 0 {
			factor := 2.0 + float64(lg.rng.Intn(3))
			if factor > 5.0 {
				factor = 5.0
			}
			rps = lg.baseRPS * factor
		} else {
			rps = lg.baseRPS
		}
	default:
		rps = lg.baseRPS
	}

	noisePct := (lg.rng.Float64()*30.0 - 15.0) / 100.0
	rps = rps * (1.0 + noisePct)
	if rps < 0 {
		rps = 0
	}
	return math.Round(rps*100) / 100
}
