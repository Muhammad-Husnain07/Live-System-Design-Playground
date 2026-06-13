export const tokens = {
  bg: {
    canvas: "#0A0A0B",
    panel: "#141415",
    subtle: "#1E1E20",
    hover: "#252528",
    active: "#2C2C30",
  },
  border: {
    default: "#2A2A2E",
    strong: "#3E3E44",
  },
  text: {
    primary: "#EDEDEF",
    secondary: "#8B8B8F",
    placeholder: "#555558",
  },
  accent: {
    primary: "#6366F1",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
  },
  metric: {
    cpu: "#A78BFA",
    memory: "#38BDF8",
    rps: "#34D399",
  },
} as const;

export type Tokens = typeof tokens;
