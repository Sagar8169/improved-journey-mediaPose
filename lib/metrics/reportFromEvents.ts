import { RawEvent, PositionType, SessionReport } from './types';
import { computeControlTimePctByPosition, computeAttempts, computeScramble, computeAvgIntensity, computeReactionAvg, countTransitions } from './kpi';

export function buildReportFromEvents(events: RawEvent[], startAt: number, endAt: number): SessionReport {
  const controlPctByPos = computeControlTimePctByPosition(events, { startAt, endAt });
  const submission = computeAttempts(events, 'submission_attempt', 'submission_result');
  const escape = computeAttempts(events, 'escape_attempt', 'escape_result');
  const sweep = computeAttempts(events, 'sweep_attempt', 'sweep_result');
  const pass = computeAttempts(events, 'pass_attempt', 'pass_result');
  const scr = computeScramble(events);
  const trans = countTransitions(events);
  const avgIntensity = computeAvgIntensity(events);
  const reactionAvg = computeReactionAvg(events);

  const guardPositions: PositionType[] = ['guard_closed','guard_open','half_guard'];
  const guardPct = guardPositions.reduce((a,p)=> a + (controlPctByPos[p] || 0), 0);

  const report: SessionReport = {
    corePositionalMetrics: {
      positionalControlTimes: controlPctByPos,
      escapes: { attempts: escape.attempts || null, successPercent: escape.attempts ? Math.round((escape.successes/escape.attempts)*100) : null },
      reversals: { count: trans.total || null, successPercent: trans.total ? Math.round((trans.success/trans.total)*100) : null },
    },
    guardMetrics: {
      guardRetentionPercent: +guardPct.toFixed(2) || null,
      sweepAttempts: sweep.attempts || null,
      sweepSuccessPercent: sweep.attempts ? Math.round((sweep.successes/sweep.attempts)*100) : null,
      passingAttempts: pass.attempts || null,
      guardPassPreventionPercent: pass.attempts ? Math.round(((pass.attempts - pass.successes)/pass.attempts)*100) : null,
    },
    transitionMetrics: {
      transitionEfficiencyPercent: trans.total ? Math.round((trans.success/trans.total)*100) : null,
      errorCounts: { failedTransition: trans.total ? (trans.total - trans.success) : 0, lostGuard: 0, positionalMistake: 0 },
    },
    submissionMetrics: {
      submissionAttempts: submission.attempts || null,
      submissionSuccessPercent: submission.attempts ? Math.round((submission.successes/submission.attempts)*100) : null,
      submissionChains: null,
      submissionDefenses: null,
    },
    scrambleMetrics: {
      scrambleFrequency: scr.attempts || null,
      scrambleWinPercent: (scr.attempts ? Math.round((scr.wins/scr.attempts)*100) : null),
      scrambleOutcomeImpact: (scr.wins + scr.losses) ? (scr.wins>scr.losses?'dominant': scr.wins===scr.losses?'neutral':'disadvantaged') : null,
    },
    effortEnduranceMetrics: {
      rollingIntensityScore: avgIntensity,
      fatigueCurve: null,
      enduranceIndicator: null,
      recoveryTimeBetweenRounds: null,
    },
    consistencyTrends: {
      sessionConsistencyRating: null,
      technicalVarietyIndex: null,
      positionalErrorTrends: null,
    },
    summary: {
      overallSessionScorecard: null,
      historicalPerformanceTrend: null,
      winLossRatioByPosition: null,
      reactionSpeed: (typeof reactionAvg === 'number') ? +(reactionAvg/1000).toFixed(3) : null,
    },
  };

  return report;
}
