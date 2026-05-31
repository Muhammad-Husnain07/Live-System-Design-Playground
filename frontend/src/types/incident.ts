export interface IncidentStep {
  triggerTick: number;
  action: "chaos_inject" | "traffic_spike" | "config_change";
  label: string;
}

export interface IncidentScenario {
  id: string;
  name: string;
  description: string;
  industry: string;
  color: string;
  steps: IncidentStep[];
}

export interface TimelineMarker {
  tick: number;
  stepIndex: number;
  label: string;
  action: string;
}

export interface PostMortem {
  rootCause: string;
  blastRadius: { nodeLabel: string; issue: string }[];
  resolutionSuggestion: string;
  scenarioName: string;
}
