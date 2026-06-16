export const spatialTokens = {
  bg: {
    void: '#050507',
    island: 'rgba(20, 20, 24, 0.80)',
    islandHover: 'rgba(30, 30, 36, 0.90)',
  },
  border: {
    island: '1px solid rgba(255, 255, 255, 0.08)',
    glow: '1px solid rgba(99, 102, 241, 0.5)',
  },
  shadow: {
    island: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05)',
    node: '0 4px 12px rgba(0, 0, 0, 0.5)',
  },
  font: {
    mono: '"JetBrains Mono", monospace',
    ui: '"Inter", sans-serif',
  },
  accent: {
    primary: '#6366F1',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  text: {
    primary: '#EDEDEF',
    secondary: '#8B8B8F',
    placeholder: '#555558',
  },
} as const;

export type SpatialTokens = typeof spatialTokens;
