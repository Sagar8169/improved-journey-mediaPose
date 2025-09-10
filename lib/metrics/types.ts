export interface RunningStat { mean: number; m2: number; count: number; }
export interface JointAngleStats extends RunningStat { min: number; max: number; }
export interface SymmetryStats extends RunningStat { min: number; max: number; }
export interface SegmentSummary {
  tStart: number; tEnd: number; reps: number; postureIssues: number;
  avgTorsoAngle?: number; shoulderSymMean?: number; kneeSymMean?: number;
}
export interface SessionQualityFlags { lowQuality?: boolean; short?: boolean; }
export interface SessionRecord {
  schemaVersion: number;
  sessionId: string;
  userId: string;
  startTs: number;
  endTs?: number;
  durationSec?: number;
  frameCount: number;
  modelComplexity: 0|1|2;
  mirrorUsed: boolean;
  detectionFrames: number;
  avgVisibilitySum: number;
  bboxAreaSumPct: number;
  bboxAreaSumSqPct: number;
  postureIssues: number;
  torsoAngleSum: number;
  torsoAngleSumSq: number;
  shoulderSym: SymmetryStats;
  kneeSym: SymmetryStats;
  jointStats: Record<string, JointAngleStats>;
  repsByMode: Record<string, number>;
  totalReps: number;
  firstRepTs?: number;
  maxRepStreak: number;
  currentStreak: number;
  interruptions: number;
  errors: string[];
  segments: SegmentSummary[];
  segActive: SegmentSummary | null;
  fpsSum: number;
  fpsSumSq: number;
  detectionRate?: number;
  avgVisibility?: number;
  formConsistencyScore?: number;
  focusScore?: number;
  qualityFlags?: SessionQualityFlags;
  finalized?: boolean;
}
export interface FrameUpdatePayload {
  hasPose: boolean;
  visibilityAvg?: number;
  bboxAreaPct?: number;
  torsoAngle?: number;
  shoulderSym?: number;
  kneeSym?: number;
  jointAngles?: Record<string, number | undefined>;
  fps?: number;
  postureIssue?: boolean;
  repMode?: string;
  repIncrement?: boolean;
}
export const SESSION_SCHEMA_VERSION = 1;
export const SEGMENT_MS = 30_000;
export const MIN_VALID_SESSION_SEC = 10;
export const MIN_DETECTION_RATE = 0.4;
