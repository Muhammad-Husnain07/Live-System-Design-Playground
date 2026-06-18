import { spatialTokens } from './spatialTokens';

export const tokens = {
  bg: spatialTokens.bg,
  border: spatialTokens.border,
  text: spatialTokens.text,
  accent: spatialTokens.accent,
  metric: spatialTokens.metric,
  z: spatialTokens.z,
} as const;

export type Tokens = typeof tokens;
