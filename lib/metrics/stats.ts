import { RunningStat } from './types';

export function initRunning(): RunningStat { return { mean: 0, m2: 0, count: 0 }; }
export function updateRunning(s: RunningStat, value: number): RunningStat {
  const count = s.count + 1;
  const delta = value - s.mean;
  const mean = s.mean + delta / count;
  const delta2 = value - mean;
  const m2 = s.m2 + delta * delta2;
  return { mean, m2, count };
}
export function finalizeVariance(s: RunningStat) {
  if (s.count < 2) return { mean: s.mean, variance: 0, stdev: 0 };
  const variance = s.m2 / (s.count - 1);
  return { mean: s.mean, variance, stdev: Math.sqrt(variance) };
}
