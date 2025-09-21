export interface RunningStat { mean: number; m2: number; count: number; }
export interface JointAngleStats extends RunningStat { min: number; max: number; }
export interface SymmetryStats extends RunningStat { min: number; max: number; }
export interface SegmentSummary {
  tStart: number; tEnd: number; reps: number; postureIssues: number;
  avgTorsoAngle?: number; shoulderSymMean?: number; kneeSymMean?: number;
}
export interface SessionQualityFlags { lowQuality?: boolean; short?: boolean; }

// ---- V2 Metrics Schema Core Enums & Raw Events ----
export type PositionType =
  | 'mount'
  | 'back_control'
  | 'side_control'
  | 'north_south'
  | 'half_guard'
  | 'guard_closed'
  | 'guard_open'
  | 'turtle'
  | 'standing'
  | 'unknown';

export type TechniqueType =
  | 'takedown'
  | 'sweep'
  | 'pass'
  | 'submission'
  | 'escape'
  | 'reversal'
  | 'transition'
  | 'scramble';

export type Outcome = 'success' | 'fail';
export type ScrambleWinner = 'self' | 'opponent' | 'unknown';

export type RawEvent =
  | { ts: number; kind: 'position_start'; position: PositionType }
  | { ts: number; kind: 'position_end'; position: PositionType }
  | { ts: number; kind: 'transition'; from: PositionType; to: PositionType; outcome?: Outcome }
  | { ts: number; kind: 'submission_attempt'; technique?: string }
  | { ts: number; kind: 'submission_result'; outcome: Outcome }
  | { ts: number; kind: 'escape_attempt' }
  | { ts: number; kind: 'escape_result'; outcome: Outcome }
  | { ts: number; kind: 'sweep_attempt' }
  | { ts: number; kind: 'sweep_result'; outcome: Outcome }
  | { ts: number; kind: 'pass_attempt' }
  | { ts: number; kind: 'pass_result'; outcome: Outcome }
  | { ts: number; kind: 'scramble_start' }
  | { ts: number; kind: 'scramble_end'; winner: ScrambleWinner }
  | { ts: number; kind: 'intensity_sample'; value: number } // 0..1
  | { ts: number; kind: 'reaction_signal'; id: string }
  | { ts: number; kind: 'reaction_move'; id: string };

export interface RawMetrics {
  events: RawEvent[];
  startAt: number;
  endAt?: number;
}

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

// Live KPIs v2: derived continuously from RawEvents
export interface LiveKPIs {
  // position control times percentage by position name
  controlTimePctByPosition: Record<string, number>;
  submission: AttemptStats;
  escape: AttemptStats;
  transition: AttemptStats;
  takedown: AttemptStats;
  pass: AttemptStats;
  sweep: AttemptStats;
  scramble: { attempts: number; wins: number; losses: number };
  guardRetentionPct: number;
  transitionEfficiencyPct: number;
  scrambleWinPct: number;
  avgIntensity: number; // 0..100
  reactionAvgMs?: number;
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
  // New session report JSON (computed at finalize)
  report?: SessionReport;
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
// New aggregated metrics schema version (DB-storable aggregated report only, no raw persistence)
export const METRICS_SCHEMA_VERSION = 2;
export const SEGMENT_MS = 30_000;
export const MIN_VALID_SESSION_SEC = 10;
export const MIN_DETECTION_RATE = 0.4;

// ---- New Session Report Schema (JSON-storable) ----
export type ScrambleOutcomeImpact = 'dominant' | 'neutral' | 'disadvantaged';

export interface SessionReportCorePositionalMetrics {
  positionalControlTimes: Record<string, number | null>; // percentages 0-100 by position
  escapes: { attempts: number | null; successPercent: number | null };
  reversals: { count: number | null; successPercent: number | null };
}

export interface SessionReportGuardMetrics {
  guardRetentionPercent: number | null;
  sweepAttempts: number | null;
  sweepSuccessPercent: number | null;
  passingAttempts: number | null;
  guardPassPreventionPercent: number | null;
}

export interface SessionReportTransitionMetrics {
  transitionEfficiencyPercent: number | null;
  errorCounts: { failedTransition: number | null; lostGuard: number | null; positionalMistake: number | null };
}

export interface SessionReportSubmissionMetrics {
  submissionAttempts: number | null;
  submissionSuccessPercent: number | null;
  submissionChains: number | null;
  submissionDefenses: number | null;
}

export interface SessionReportScrambleMetrics {
  scrambleFrequency: number | null;
  scrambleWinPercent: number | null;
  scrambleOutcomeImpact: ScrambleOutcomeImpact | null;
}

export interface SessionReportEffortEnduranceMetrics {
  rollingIntensityScore: number | null;
  fatigueCurve: number[] | null;
  enduranceIndicator: number | null;
  recoveryTimeBetweenRounds: number | null; // seconds
}

export interface SessionReportConsistencyTrends {
  sessionConsistencyRating: number | null;
  technicalVarietyIndex: number | null;
  positionalErrorTrends: string[] | null;
}

export interface SessionReportSummary {
  overallSessionScorecard: number | null;
  historicalPerformanceTrend: number[] | null;
  winLossRatioByPosition: Record<string, number> | null; // position -> ratio
  reactionSpeed: number | null; // seconds
}

export interface SessionReport {
  corePositionalMetrics: SessionReportCorePositionalMetrics;
  guardMetrics: SessionReportGuardMetrics;
  transitionMetrics: SessionReportTransitionMetrics;
  submissionMetrics: SessionReportSubmissionMetrics;
  scrambleMetrics: SessionReportScrambleMetrics;
  effortEnduranceMetrics: SessionReportEffortEnduranceMetrics;
  consistencyTrends: SessionReportConsistencyTrends;
  summary: SessionReportSummary;
}
