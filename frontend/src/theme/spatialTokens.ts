export const spatialTokens = {
  bg: {
    void: '#050507',
    island: 'rgba(20, 20, 24, 0.80)',
    islandHover: 'rgba(30, 30, 36, 0.90)',
  },
  border: {
    island: '1px solid rgba(255, 255, 255, 0.08)',
    glow: '1px solid rgba(99, 102, 241, 0.5)',
    error: '1px solid rgba(239, 68, 68, 0.5)',
    success: '1px solid rgba(34, 197, 94, 0.4)',
  },
  shadow: {
    island: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05)',
    node: '0 4px 12px rgba(0, 0, 0, 0.5)',
    glow: '0 0 20px rgba(99, 102, 241, 0.15)',
    error: '0 0 15px rgba(239, 68, 68, 0.6)',
    success: '0 0 15px rgba(34, 197, 94, 0.4)',
    elevation: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
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
    purple: '#A855F7',
    cyan: '#06B6D4',
  },
  text: {
    primary: '#EDEDEF',
    secondary: '#8B8B8F',
    placeholder: '#555558',
    dim: 'rgba(255,255,255,0.3)',
  },
  metrics: {
    rps: '#34D399',
    latency: '#60A5FA',
    cpu: '#F59E0B',
    memory: '#38BDF8',
    error: '#EF4444',
  },
  animation: {
    spring: { stiffness: 300, damping: 20 },
    duration: { fast: 0.12, normal: 0.2, slow: 0.35 },
  },
  z: {
    canvas: 0,
    canvasControls: 10,
    floatingPanels: 100,
    topToolbar: 200,
    actionDock: 300,
    radialMenu: 400,
    modals: 500,
    toasts: 900,
  },
} as const;

export type SpatialTokens = typeof spatialTokens;
