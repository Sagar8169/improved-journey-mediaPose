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
              <th className="py-2 px-3">Form</th>
              <th className="py-2 px-3">Det%</th>
              <th className="py-2 px-3">Sym (Should/Knee)</th>
              <th className="py-2 px-3">Posture</th>
              <th className="py-2 px-3">Flags</th>
              <th className="py-2 px-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(rec => {
              const detPct = rec.detectionRate!=null? (rec.detectionRate*100).toFixed(0)+'%':'—';
              const symS = rec.shoulderSym.count? Math.round(rec.shoulderSym.min):'—';
              const symK = rec.kneeSym.count? Math.round(rec.kneeSym.min):'—';
              return (
                <>
                <tr key={rec.sessionId} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                  <td className="py-2 px-3 whitespace-nowrap">{timeAgo(rec.startTs)}</td>
                  <td className="py-2 px-3">{formatDuration(rec.durationSec)}</td>
                  <td className="py-2 px-3">{rec.totalReps}</td>
                  <td className="py-2 px-3">{rec.formConsistencyScore ?? '—'}</td>
                  <td className="py-2 px-3">{detPct}</td>
                  <td className="py-2 px-3">{symS} / {symK}</td>
                  <td className="py-2 px-3">{rec.postureIssues}</td>
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
  const variance = (stat:{m2:number;count:number}) => stat.count>1? (stat.m2/(stat.count-1)).toFixed(1):'—';
  const jointEntries = Object.entries(rec.jointStats).slice(0,12);
  return (
    <tr className="bg-neutral-950/70 border-t border-neutral-900">
      <td colSpan={9} className="p-4">
        <div className="grid md:grid-cols-3 gap-6 text-[11px] text-neutral-400">
          <div className="space-y-2">
            <h4 className="font-semibold text-neutral-300">Symmetry Detail</h4>
            <p>Shoulder min/max: {rec.shoulderSym.min===Infinity? '—': Math.round(rec.shoulderSym.min)} / {rec.shoulderSym.max===-Infinity? '—': Math.round(rec.shoulderSym.max)}</p>
            <p>Shoulder variance: {variance(rec.shoulderSym)}</p>
            <p>Knee min/max: {rec.kneeSym.min===Infinity? '—': Math.round(rec.kneeSym.min)} / {rec.kneeSym.max===-Infinity? '—': Math.round(rec.kneeSym.max)}</p>
            <p>Knee variance: {variance(rec.kneeSym)}</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-neutral-300">Posture & Focus</h4>
            <p>Posture issues: {rec.postureIssues}</p>
            <p>Focus score: {rec.focusScore?.toFixed(0) ?? '—'}</p>
            <p>Form score: {rec.formConsistencyScore ?? '—'}</p>
            <p>Detection rate: {rec.detectionRate? (rec.detectionRate*100).toFixed(1)+'%':'—'}</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-neutral-300">Joint Ranges</h4>
            {jointEntries.length? (
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                {jointEntries.map(([k,v])=> <li key={k}>{k}: {Math.round(v.min)}–{Math.round(v.max)}</li>)}
              </ul>
            ): <p>—</p>}
          </div>
        </div>
      </td>
    </tr>
  );
};
