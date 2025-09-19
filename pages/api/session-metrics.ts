import type { NextApiRequest, NextApiResponse } from 'next';
import { SESSION_SCHEMA_VERSION, SessionReport } from '@/lib/metrics/types';

type Data = {
	status: 'ok';
	schemaVersion: number;
	message: string;
	exampleReport: SessionReport;
};

const exampleReport: SessionReport = {
	corePositionalMetrics: {
		positionalControlTimes: { mount: null, backControl: null, sideControl: null },
		escapes: { attempts: null, successPercent: null },
		reversals: { count: null, successPercent: null },
	},
	guardMetrics: {
		guardRetentionPercent: null,
		sweepAttempts: null,
		sweepSuccessPercent: null,
		passingAttempts: null,
		guardPassPreventionPercent: null,
	},
	transitionMetrics: {
		transitionEfficiencyPercent: null,
		errorCounts: { failedTransition: null, lostGuard: null, positionalMistake: null },
	},
	submissionMetrics: {
		submissionAttempts: null,
		submissionSuccessPercent: null,
		submissionChains: null,
		submissionDefenses: null,
	},
	scrambleMetrics: {
		scrambleFrequency: null,
		scrambleWinPercent: null,
		scrambleOutcomeImpact: null,
	},
	effortEnduranceMetrics: {
		rollingIntensityScore: null,
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
		reactionSpeed: null,
	},
};

export default function handler(
	req: NextApiRequest,
	res: NextApiResponse<Data>
) {
	res.status(200).json({
		status: 'ok',
		schemaVersion: SESSION_SCHEMA_VERSION,
		message: 'Session metrics API stub. Client stores per-session reports; integrate DB to persist.',
		exampleReport,
	});
}
