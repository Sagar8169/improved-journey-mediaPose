import { GrapplingKPIs, SessionRecord, SessionReport, ScrambleOutcomeImpact } from './types';

function pct(numer: number, denom: number): number | null {
	if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom <= 0) return null;
	return Math.max(0, Math.min(100, (numer / denom) * 100));
}

function seconds(ms?: number): number | null { return (ms == null || !Number.isFinite(ms)) ? null : +(ms/1000).toFixed(3); }

function safe<T>(fn: () => T, onError: (e: any) => void): T | null {
	try { return fn(); } catch(e) { onError(e); return null as any; }
}

function inferScrambleImpact(kpi?: GrapplingKPIs): ScrambleOutcomeImpact | null {
	if (!kpi) return null;
	const wins = kpi.scramble?.wins ?? 0;
	const losses = kpi.scramble?.losses ?? 0;
	if (wins + losses < 1) return null;
	if (wins > losses) return 'dominant';
	if (wins === losses) return 'neutral';
	return 'disadvantaged';
}

export function buildSessionReport(rec: SessionRecord, history?: SessionRecord[]): SessionReport {
	const g = rec.grappling;
	const errors = rec.errors || (rec.errors = []);

	const totalControlMs = g ? Object.values(g.controlTimeByPos || {}).reduce((a,b)=>a + (b||0), 0) : 0;
	const durMs = (rec.endTs && rec.startTs) ? (rec.endTs - rec.startTs) : 0;

	const positionalControlTimes: Record<string, number | null> = {};
	if (g && g.controlTimeByPos) {
		for (const [pos, ms] of Object.entries(g.controlTimeByPos)) {
			positionalControlTimes[pos] = pct(ms, Math.max(1, durMs));
		}
	}

	// Guard-related estimates based on available attempts
	const guardRetentionPercent = g?.guardRetentionPct ?? pct((g?.sweep?.attempts || 0) + (g?.pass?.attempts || 0) - (g?.pass?.successes || 0), (g?.sweep?.attempts || 0) + (g?.pass?.attempts || 0));
	const guardPassPreventionPercent = g?.guardPassPreventionPct ?? pct((g?.pass?.attempts || 0) - (g?.pass?.successes || 0), (g?.pass?.attempts || 0));

	// Transition efficiency
	const transitionEfficiencyPercent = g?.transitionEfficiencyPct ?? pct(g?.transition?.successes || 0, g?.transition?.attempts || 0);

	// Error counts: not tracked explicitly; set to 0 if we can infer nothing
	const errorCounts = { failedTransition: 0, lostGuard: 0, positionalMistake: rec.postureIssues || 0 };

	// Submission chains: without event chain detection, default to attempts as proxy / rounds ~= segments
	const submissionChains = (g?.submission?.attempts ?? null);

	// Scramble
	const scrambleAttempts = g?.scramble?.attempts ?? 0;
	const scrambleWins = g?.scramble?.wins ?? 0;
	const scrambleWinPercent = pct(scrambleWins, scrambleAttempts || 0);
	const scrambleOutcomeImpact = inferScrambleImpact(g);

	// Effort & endurance
	const rollingIntensityScore = g?.intensityScore ?? null;
	const fatigueCurve = safe(() => {
		// use segment posture issues per minute increase as a crude fatigue curve
		if (!rec.segments?.length) return null;
		const bySeg = rec.segments.map(s => (s.postureIssues / Math.max(1, (s.tEnd - s.tStart)/60000)));
		return bySeg.map(v=> +(+v).toFixed(2));
	}, (e)=> errors.push('fatigue_curve:' + (e?.message || String(e))));

	const enduranceIndicator = safe(() => {
		if (!Array.isArray(fatigueCurve) || fatigueCurve.length < 2) return null;
		// negative slope means endurance (less issues/min over time)
		const first = fatigueCurve[0]; const last = fatigueCurve[fatigueCurve.length - 1];
		const delta = first - last; // higher is better
		return +((delta / Math.max(1, first || 1)) * 100).toFixed(1);
	}, (e)=> errors.push('endurance_indicator:' + (e?.message || String(e))));

	const recoveryTimeBetweenRounds = safe(() => {
		if (!rec.segments || rec.segments.length < 2) return null;
		let gaps: number[] = [];
		for (let i=1;i<rec.segments.length;i++) gaps.push(rec.segments[i].tStart - rec.segments[i-1].tEnd);
		const avg = gaps.reduce((a,b)=>a+b,0) / gaps.length;
		return seconds(avg);
	}, (e)=> errors.push('recovery_time:' + (e?.message || String(e))));

	// Consistency & trends
	const sessionConsistencyRating = rec.grappling?.consistencyRating ?? rec.formConsistencyScore ?? null;
	const technicalVarietyIndex = g?.technicalVarietyIdx ?? (g ? Object.keys(g.controlTimeByPos||{}).length : null);
	const positionalErrorTrends = safe(() => {
		if (!rec.segments?.length) return null;
		const labels: string[] = [];
		// Basic heuristic: if a segment has postureIssues > 0, label as 'positional mistake'
		if (rec.segments.some(s=>s.postureIssues>0)) labels.push('positional mistake');
		return labels.length ? labels : null;
	}, (e)=> errors.push('positional_error_trends:' + (e?.message || String(e))));

	// Summary
	const overallSessionScorecard = safe(() => {
		const a = (sessionConsistencyRating ?? 0);
		const b = (rollingIntensityScore ?? 0);
		const c = 100 - (rec.postureIssues || 0);
		return +((0.5*a + 0.3*b + 0.2*Math.max(0,c)).toFixed(1));
	}, (e)=> { errors.push('overall_score:' + (e?.message || String(e))); return null; }) as number | null;

	const historicalPerformanceTrend = safe(() => {
		if (!history || !history.length) return null;
		return history.slice(0,10).map(h => h.report?.summary.overallSessionScorecard ?? (h.formConsistencyScore ?? 0));
	}, (e)=> { errors.push('historical_trend:' + (e?.message || String(e))); return null; }) as number[] | null;

	const winLossRatioByPosition = safe(() => {
		if (!g?.winLossByPosition) return null;
		const out: Record<string, number> = {};
		for (const [pos, wl] of Object.entries(g.winLossByPosition)) {
			const denom = (wl.wins + wl.losses) || 0;
			out[pos] = denom ? +(wl.wins / denom).toFixed(2) : 0;
		}
		return out;
	}, (e)=> { errors.push('win_loss_by_pos:' + (e?.message || String(e))); return null; }) as Record<string, number> | null;

	const reactionSpeed = seconds(g?.reactionTimeMs);

	// Core positional
	const escapesAttempts = g?.escape?.attempts ?? null;
	const escapesSuccess = g?.escape?.successes ?? null;
	const escapesSuccessPercent = pct(escapesSuccess || 0, escapesAttempts || 0);
	const reversalsCount = g?.transition?.attempts ?? null; // as a proxy if no separate reversal classifier
	const reversalsSuccessPercent = pct(g?.transition?.successes || 0, g?.transition?.attempts || 0);

	const report: SessionReport = {
		corePositionalMetrics: {
			positionalControlTimes,
			escapes: { attempts: escapesAttempts, successPercent: escapesSuccessPercent },
			reversals: { count: reversalsCount, successPercent: reversalsSuccessPercent },
		},
		guardMetrics: {
			guardRetentionPercent,
			sweepAttempts: g?.sweep?.attempts ?? null,
			sweepSuccessPercent: pct(g?.sweep?.successes || 0, g?.sweep?.attempts || 0),
			passingAttempts: g?.pass?.attempts ?? null,
			guardPassPreventionPercent,
		},
		transitionMetrics: {
			transitionEfficiencyPercent,
			errorCounts,
		},
		submissionMetrics: {
			submissionAttempts: g?.submission?.attempts ?? null,
			submissionSuccessPercent: pct(g?.submission?.successes || 0, g?.submission?.attempts || 0),
			submissionChains,
			submissionDefenses: null, // not tracked yet
		},
		scrambleMetrics: {
			scrambleFrequency: scrambleAttempts || null,
			scrambleWinPercent,
			scrambleOutcomeImpact,
		},
		effortEnduranceMetrics: {
			rollingIntensityScore,
			fatigueCurve,
			enduranceIndicator,
			recoveryTimeBetweenRounds,
		},
		consistencyTrends: {
			sessionConsistencyRating,
			technicalVarietyIndex,
			positionalErrorTrends,
		},
		summary: {
			overallSessionScorecard,
			historicalPerformanceTrend,
			winLossRatioByPosition,
			reactionSpeed,
		},
	};

	return report;
}
