export interface CommandAction {
  id: string;
  label: string;
  searchTerms: string[];
  category: "Nodes" | "Simulation" | "Chaos" | "Panels" | "History" | "Export";
}

export type CommandCategory = CommandAction["category"];

export const SIMULATION_ACTIONS: CommandAction[] = [
  { id: "start-simulation", label: "Start Simulation", searchTerms: ["run", "start", "play"], category: "Simulation" },
  { id: "stop-simulation", label: "Stop Simulation", searchTerms: ["stop", "end", "pause", "halt"], category: "Simulation" },
];

export const PANEL_ACTIONS: CommandAction[] = [
  { id: "toggle-chaos", label: "Toggle Chaos Panel", searchTerms: ["chaos", "inject", "fault"], category: "Panels" },
  { id: "toggle-deploy", label: "Toggle Deploy Panel", searchTerms: ["deploy", "deployment", "canary"], category: "Panels" },
  { id: "toggle-security", label: "Toggle Security Panel", searchTerms: ["security", "audit", "vulnerability"], category: "Panels" },
  { id: "toggle-finops", label: "Toggle FinOps Panel", searchTerms: ["cost", "money", "finops", "pricing"], category: "Panels" },
  { id: "toggle-drill", label: "Toggle Drill Panel", searchTerms: ["drill", "disaster", "recovery"], category: "Panels" },
  { id: "open-export", label: "Open Export Modal", searchTerms: ["export", "iac", "terraform", "kubernetes"], category: "Panels" },
];

export const HISTORY_ACTIONS: CommandAction[] = [
  { id: "undo", label: "Undo", searchTerms: ["back", "revert", "undo"], category: "History" },
  { id: "redo", label: "Redo", searchTerms: ["forward", "redo"], category: "History" },
];

export const EXPORT_ACTIONS: CommandAction[] = [
  { id: "export-terraform", label: "Export as Terraform", searchTerms: ["iac", "tf", "hcl", "terraform"], category: "Export" },
  { id: "export-kubernetes", label: "Export as Kubernetes", searchTerms: ["k8s", "kubernetes", "yaml"], category: "Export" },
  { id: "export-cloudformation", label: "Export as CloudFormation", searchTerms: ["cf", "cloudformation", "json"], category: "Export" },
];
