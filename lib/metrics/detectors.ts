import type { RawEvent, PositionType } from './types';

export type FrameFeatures = {
  ts: number;
  bboxAreaPct?: number;
  hasPose?: boolean;
  // extend with more features as needed
};

export function estimateIntensity(frame: FrameFeatures): RawEvent | null {
  if (typeof frame.bboxAreaPct !== 'number') return null;
  // Very crude: treat area change as motion; the tracker will convert to 0..100 later via EMA
  const normalized = Math.max(0, Math.min(1, frame.bboxAreaPct));
  return { ts: frame.ts, kind: 'intensity_sample', value: normalized };
}

export function placeholderPositionDetector(_frame: FrameFeatures): RawEvent[] {
  // Stub: we don't have CV for grappling positions yet. Optionally emit 'unknown' start once at beginning.
  return [];
}

export function detectTransitions(_frame: FrameFeatures): RawEvent[] { return []; }
export function detectSubmissions(_frame: FrameFeatures): RawEvent[] { return []; }
export function detectEscapes(_frame: FrameFeatures): RawEvent[] { return []; }
