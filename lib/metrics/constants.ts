// Aggregated metrics constants for v2
export const METRICS_SCHEMA_VERSION = 2 as const;
export const SCORE_WEIGHTS: Record<string, number> = {
  control: 0.25,
  submissions: 0.2,
  escapes: 0.15,
  transitions: 0.15,
  scrambles: 0.1,
  endurance: 0.1,
  reaction: 0.05,
};
