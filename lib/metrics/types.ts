export interface RunningStat { mean: number; m2: number; count: number; }
export interface JointAngleStats extends RunningStat { min: number; max: number; }
export interface SymmetryStats extends RunningStat { min: number; max: number; }
export interface SegmentSummary {
  tStart: number; tEnd: number; reps: number; postureIssues: number;
  avgTorsoAngle?: number; shoulderSymMean?: number; kneeSymMean?: number;
}
export interface SessionQualityFlags { lowQuality?: boolean; short?: boolean; }

// ---- Grappling KPI Types (Rollmetrics) ----
export interface PositionSpan { name: string; confidence: number; tStart: number; tEnd?: number; }
export interface AttemptStats { attempts: number; successes: number; }
export interface GrapplingKPIs {
  // Position control timeline and aggregates
  controlTimeline: PositionSpan[];
  controlTimeByPos: Record<string, number>; // ms per position name
  controlPercentPct?: number; // convenience: overall control time percentage 0-100
  // Attempts and outcomes by category
  submission: AttemptStats;
  escape: AttemptStats;
  transition: AttemptStats;
  takedown: AttemptStats;
  pass: AttemptStats; // guard pass attempts
  sweep: AttemptStats;
  scramble: { attempts: number; wins: number; losses: number };
  // Derived metrics (optional until event classifier is present)
  guardRetentionPct?: number; // retained guard vs pass attempts
  guardPassPreventionPct?: number; // prevented passes vs attempts
  pressurePassingSuccessPct?: number; // passes completed when attacking top
  transitionEfficiencyPct?: number; // completed transitions / attempts
  positionalErrorTrend?: 'up' | 'down' | 'flat';
  consistencyRating?: number; // mirrors formConsistencyScore
  enduranceFatigue?: { fatigueTrend?: 'building' | 'fading' | 'stable'; };
  technicalVarietyIdx?: number; // unique techniques/positions seen
  winLossByPosition?: Record<string, { wins: number; losses: number }>;
  intensityScore?: number; // 0-100, rolling intensity
  reactionTimeMs?: number; // time to first meaningful movement
  recoveryTimeMs?: number; // between rounds (post-session)
}
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
  // ---- Grappling KPIs (live + finalized) ----
  grappling?: GrapplingKPIs;
  // Live helpers for KPI computation
  firstPoseTs?: number; // time when we first detected pose
  lastBboxAreaPct?: number; // to compute motion delta per frame
  intensityEma?: number; // 0-100 scaled rolling intensity
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
