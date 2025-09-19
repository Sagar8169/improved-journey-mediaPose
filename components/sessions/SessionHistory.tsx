import { usePoseStore } from '@/components/usePoseStore';
import { useMemo, useState } from 'react';
import { SessionRecord } from '@/lib/metrics/types';

function formatDuration(sec?: number){ if(!sec && sec!==0) return '—'; const m=Math.floor(sec/60); const s=Math.round(sec%60); return `${m}m ${s}s`; }
function timeAgo(ts:number){ const d=Date.now()-ts; const mins=Math.floor(d/60000); if(mins<1) return 'just now'; if(mins<60) return mins+'m ago'; const hrs=Math.floor(mins/60); if(hrs<24) return hrs+'h ago'; const days=Math.floor(hrs/24); return days+'d ago'; }

export const SessionHistory = () => {
  const history = usePoseStore(s=>s.sessionHistory);
  const [expanded, setExpanded] = useState<string|null>(null);
  const [filterLowQ, setFilterLowQ] = useState(true);
  const filtered = useMemo(()=> history.filter(r=> filterLowQ ? !r.qualityFlags?.lowQuality : true), [history, filterLowQ]);

  if(!history.length) return <div className="text-xs text-neutral-500">No detailed sessions yet. Run a drill and end the session to populate history.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-neutral-300">Session History</h3>
        <label className="text-[11px] flex items-center gap-1 text-neutral-500 cursor-pointer"><input type="checkbox" className="accent-emerald-500" checked={filterLowQ} onChange={e=>setFilterLowQ(e.target.checked)} />Hide Low Quality</label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full text-[11px]">
          <thead className="bg-neutral-900/70 text-neutral-400">
            <tr className="text-left">
              <th className="py-2 px-3">Time</th>
              <th className="py-2 px-3">Duration</th>
              <th className="py-2 px-3">Reps</th>
              <th className="py-2 px-3">Overall</th>
              <th className="py-2 px-3">Det%</th>
              <th className="py-2 px-3">Intensity</th>
              <th className="py-2 px-3">Reaction</th>
              <th className="py-2 px-3">Flags</th>
              <th className="py-2 px-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(rec => {
              const detPct = rec.detectionRate!=null? (rec.detectionRate*100).toFixed(0)+'%':'—';
              const overall = rec.report?.summary.overallSessionScorecard ?? rec.formConsistencyScore ?? '—';
              const intensity = rec.report?.effortEnduranceMetrics.rollingIntensityScore ?? rec.grappling?.intensityScore ?? '—';
              const reaction = rec.report?.summary.reactionSpeed ?? (rec.grappling?.reactionTimeMs ? (rec.grappling.reactionTimeMs/1000).toFixed(2) : '—');
              return (
                <>
                <tr key={rec.sessionId} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                  <td className="py-2 px-3 whitespace-nowrap">{timeAgo(rec.startTs)}</td>
                  <td className="py-2 px-3">{formatDuration(rec.durationSec)}</td>
                  <td className="py-2 px-3">{rec.totalReps}</td>
                  <td className="py-2 px-3">{typeof overall === 'number'? overall.toFixed(0) : overall}</td>
                  <td className="py-2 px-3">{detPct}</td>
                  <td className="py-2 px-3">{typeof intensity === 'number'? intensity.toFixed(0): intensity}</td>
                  <td className="py-2 px-3">{typeof reaction === 'number'? reaction.toFixed(2): reaction}</td>
                  <td className="py-2 px-3 space-x-1">
                    {rec.qualityFlags?.short && <span className="inline-block px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300">SHORT</span>}
                    {rec.qualityFlags?.lowQuality && <span className="inline-block px-1.5 py-0.5 rounded bg-yellow-600/30 text-yellow-300">LOW Q</span>}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button onClick={()=> setExpanded(e=> e===rec.sessionId? null: rec.sessionId)} className="text-emerald-400 hover:text-cyan-300">{expanded===rec.sessionId? 'Hide':'View'}</button>
                  </td>
                </tr>
                {expanded===rec.sessionId && <ExpandedRow rec={rec} />}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ExpandedRow = ({ rec }: { rec: SessionRecord }) => {
  const r = rec.report;
  if (!r) {
    return (
      <tr className="bg-neutral-950/70 border-t border-neutral-900">
        <td colSpan={9} className="p-4 text-[11px] text-neutral-400">No report available.</td>
      </tr>
    );
  }
  return (
    <tr className="bg-neutral-950/70 border-t border-neutral-900">
      <td colSpan={9} className="p-4">
        <div className="grid md:grid-cols-3 gap-6 text-[11px] text-neutral-400">
          <div className="space-y-2">
            <h4 className="font-semibold text-neutral-300">Core Positional Metrics</h4>
            <p>Control Time % by Position:</p>
            {r.corePositionalMetrics.positionalControlTimes && Object.keys(r.corePositionalMetrics.positionalControlTimes).length ? (
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                {Object.entries(r.corePositionalMetrics.positionalControlTimes).map(([pos, val])=> (
                  <li key={pos}>{pos}: {val==null? '—' : val.toFixed(1)+'%'}</li>
                ))}
              </ul>
            ) : <p>—</p>}
            <p>Escapes: attempts {r.corePositionalMetrics.escapes.attempts ?? '—'}, success {r.corePositionalMetrics.escapes.successPercent==null? '—' : r.corePositionalMetrics.escapes.successPercent.toFixed(1)+'%'}</p>
            <p>Reversals: count {r.corePositionalMetrics.reversals.count ?? '—'}, success {r.corePositionalMetrics.reversals.successPercent==null? '—' : r.corePositionalMetrics.reversals.successPercent.toFixed(1)+'%'}</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-neutral-300">Guard Metrics</h4>
            <p>Guard Retention: {r.guardMetrics.guardRetentionPercent==null? '—' : r.guardMetrics.guardRetentionPercent.toFixed(1)+'%'}</p>
            <p>Sweeps: attempts {r.guardMetrics.sweepAttempts ?? '—'}, success {r.guardMetrics.sweepSuccessPercent==null? '—' : r.guardMetrics.sweepSuccessPercent.toFixed(1)+'%'}</p>
            <p>Passing: attempts {r.guardMetrics.passingAttempts ?? '—'}, pass prevention {r.guardMetrics.guardPassPreventionPercent==null? '—' : r.guardMetrics.guardPassPreventionPercent.toFixed(1)+'%'}</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-neutral-300">Transition Metrics</h4>
            <p>Transition Efficiency: {r.transitionMetrics.transitionEfficiencyPercent==null? '—' : r.transitionMetrics.transitionEfficiencyPercent.toFixed(1)+'%'}</p>
            <p>Errors: failed transitions {r.transitionMetrics.errorCounts.failedTransition ?? '—'}, lost guard {r.transitionMetrics.errorCounts.lostGuard ?? '—'}, positional mistakes {r.transitionMetrics.errorCounts.positionalMistake ?? '—'}</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-neutral-300">Submission Metrics</h4>
            <p>Attempts {r.submissionMetrics.submissionAttempts ?? '—'}, success {r.submissionMetrics.submissionSuccessPercent==null? '—' : r.submissionMetrics.submissionSuccessPercent.toFixed(1)+'%'}</p>
            <p>Chains {r.submissionMetrics.submissionChains ?? '—'} | Defenses {r.submissionMetrics.submissionDefenses ?? '—'}</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-neutral-300">Scramble Metrics</h4>
            <p>Frequency {r.scrambleMetrics.scrambleFrequency ?? '—'} | Win% {r.scrambleMetrics.scrambleWinPercent==null? '—' : r.scrambleMetrics.scrambleWinPercent.toFixed(1)+'%'}</p>
            <p>Outcome Impact: {r.scrambleMetrics.scrambleOutcomeImpact ?? '—'}</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-neutral-300">Effort & Endurance</h4>
            <p>Rolling Intensity: {r.effortEnduranceMetrics.rollingIntensityScore==null? '—' : r.effortEnduranceMetrics.rollingIntensityScore.toFixed(0)}</p>
            <p>Endurance Indicator: {r.effortEnduranceMetrics.enduranceIndicator==null? '—' : r.effortEnduranceMetrics.enduranceIndicator.toFixed(1)}</p>
            <p>Recovery Time: {r.effortEnduranceMetrics.recoveryTimeBetweenRounds==null? '—' : r.effortEnduranceMetrics.recoveryTimeBetweenRounds.toFixed(2)+'s'}</p>
            {Array.isArray(r.effortEnduranceMetrics.fatigueCurve) && r.effortEnduranceMetrics.fatigueCurve.length>0 && (
              <div>
                <p>Fatigue Curve:</p>
                <ul className="grid grid-cols-6 gap-1">
                  {r.effortEnduranceMetrics.fatigueCurve.map((v,i)=> <li key={i}>{v.toFixed(2)}</li>)}
                </ul>
              </div>
            )}
          </div>
          <div className="space-y-2 md:col-span-3">
            <h4 className="font-semibold text-neutral-300">Consistency & Trends</h4>
            <p>Session Consistency Rating: {r.consistencyTrends.sessionConsistencyRating==null? '—' : r.consistencyTrends.sessionConsistencyRating.toFixed(0)}</p>
            <p>Technical Variety Index: {r.consistencyTrends.technicalVarietyIndex ?? '—'}</p>
            <p>Positional Error Trends: {r.consistencyTrends.positionalErrorTrends?.length? r.consistencyTrends.positionalErrorTrends.join(', ') : '—'}</p>
          </div>
          <div className="space-y-2 md:col-span-3">
            <h4 className="font-semibold text-neutral-300">Summary</h4>
            <p>Overall Session Scorecard: {r.summary.overallSessionScorecard==null? '—' : r.summary.overallSessionScorecard.toFixed(1)}</p>
            <p>Historical Performance Trend: {r.summary.historicalPerformanceTrend?.length? r.summary.historicalPerformanceTrend.map(v=>v.toFixed(0)).join(' → ') : '—'}</p>
            <div>
              <p>Win/Loss Ratio by Position:</p>
              {r.summary.winLossRatioByPosition && Object.keys(r.summary.winLossRatioByPosition).length? (
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {Object.entries(r.summary.winLossRatioByPosition).map(([pos, ratio])=> <li key={pos}>{pos}: {ratio.toFixed(2)}</li>)}
                </ul>
              ) : <p>—</p>}
            </div>
            <p>Reaction Speed: {r.summary.reactionSpeed==null? '—' : r.summary.reactionSpeed.toFixed(2)+'s'}</p>
          </div>
        </div>
      </td>
    </tr>
  );
};
