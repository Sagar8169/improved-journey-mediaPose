import React, { useEffect, useMemo, useState } from 'react';
import { sessions as apiSessions, ApiError } from '@/lib/apiClient';
import type { SessionSummary } from '@/lib/server/validation';
import type { SessionRecord } from '@/lib/metrics/types';

function formatDuration(ms?: number) { 
  if (!ms && ms !== 0) return '—'; 
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60); 
  const s = sec % 60; 
  return `${m}m ${s}s`; 
}

function timeAgo(ts: number) { 
  const d = Date.now() - ts; 
  const mins = Math.floor(d / 60000); 
  if (mins < 1) return 'just now'; 
  if (mins < 60) return mins + 'm ago'; 
  const hrs = Math.floor(mins / 60); 
  if (hrs < 24) return hrs + 'h ago'; 
  const days = Math.floor(hrs / 24); 
  return days + 'd ago'; 
}

export const SessionHistory = () => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterLowQ, setFilterLowQ] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cache of detailed raw reports per session id
  const [details, setDetails] = useState<Record<string, { rawReport?: SessionRecord; summary?: any }>>({});

  // fetch total count (without filtering) to preserve "x of y" UI
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await apiSessions.list({ page: 1, limit: 1, hideLowQuality: false });
        if (!cancelled) setTotalCount(resp.pagination.total);
      } catch (e) {
        // ignore count errors
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // fetch sessions based on filter
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    apiSessions.list({ page: 1, limit: 50, hideLowQuality: filterLowQ })
      .then(resp => { if (!cancelled) setSessions(resp.sessions || []); })
      .catch((e: any) => { if (!cancelled) setError(e instanceof ApiError ? e.message : 'Failed to load sessions'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filterLowQ]);

  const toggleExpanded = async (sessionId: string) => {
    const next = expanded === sessionId ? null : sessionId;
    setExpanded(next);
    if (next && !details[next]) {
      try {
        const detail = await apiSessions.get(next);
        setDetails(d => ({ ...d, [next]: { rawReport: detail.rawReport as SessionRecord | undefined, summary: detail.summary } }));
      } catch (e) {
        // ignore detail errors for now
      }
    }
  };

  if (loading && sessions.length === 0) {
    return <div className="text-xs text-neutral-500">Loading sessions…</div>;
  }

  if (error) {
    return <div className="text-xs text-red-400">{error}</div>;
  }

  if (!sessions.length) {
    return (
      <div className="text-xs text-neutral-500">
        No training sessions yet. Complete a drill to see your session history here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-neutral-300">Session History</h3>
        <div className="flex items-center gap-4">
          <label className="text-[11px] flex items-center gap-1 text-neutral-500 cursor-pointer">
            <input 
              type="checkbox" 
              className="accent-emerald-500" 
              checked={filterLowQ} 
              onChange={e => setFilterLowQ(e.target.checked)} 
            />
            Hide Low Quality
          </label>
          <span className="text-[11px] text-neutral-500">
            {sessions.length} of {totalCount || sessions.length} sessions
          </span>
        </div>
      </div>
      
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full text-[11px]">
          <thead className="bg-neutral-900/70 text-neutral-400">
            <tr className="text-left">
              <th className="py-2 px-3">Time</th>
              <th className="py-2 px-3">Duration</th>
              <th className="py-2 px-3">Reps</th>
              <th className="py-2 px-3">Detection</th>
              <th className="py-2 px-3">Quality</th>
              <th className="py-2 px-3">Score</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(session => {
              const startMs = Date.parse(session.startAt);
              const durationMs = session.durationMs;
              const detectionRatePct = session.detectionRate != null ? Math.round(session.detectionRate * 100) : 0;
              const q = session.qualityFlag || 'unknown';
              let qualityColor = 'bg-neutral-700 text-neutral-300';
              if (q === 'good') qualityColor = 'bg-green-600/30 text-green-300';
              else if (q === 'low') qualityColor = 'bg-yellow-600/30 text-yellow-300';
              const overallScore = session.summary?.summary?.overallSessionScorecard;

              const isExpanded = expanded === session.id;
              const detail = details[session.id];
              const rr = detail?.rawReport;

              return (
                <React.Fragment key={session.id}>
                  <tr className="border-t border-neutral-800 hover:bg-neutral-900/40">
                    <td className="py-2 px-3 whitespace-nowrap">{timeAgo(startMs)}</td>
                    <td className="py-2 px-3">{formatDuration(durationMs)}</td>
                    <td className="py-2 px-3 text-emerald-400">{session.reps ?? rr?.totalReps ?? 0}</td>
                    <td className="py-2 px-3">{detectionRatePct}%</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${qualityColor}`}>
                        {(q || 'UNKNOWN').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-3">{overallScore ? Math.round(overallScore) : '—'}</td>
                    <td className="py-2 px-3 text-right">
                      <button 
                        onClick={() => toggleExpanded(session.id)} 
                        className="text-emerald-400 hover:text-cyan-300"
                      >
                        {isExpanded ? 'Hide' : 'View'}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="px-3 pb-4 bg-neutral-900/20">
                        <div className="mt-2 p-3 bg-neutral-800/50 rounded text-xs">
                          <div className="grid grid-cols-2 gap-4 text-neutral-400 mb-4">
                            <div>
                              <strong>Started:</strong> {new Date(session.startAt).toLocaleString()}
                            </div>
                            {session.endAt && (
                              <div>
                                <strong>Ended:</strong> {new Date(session.endAt).toLocaleString()}
                              </div>
                            )}
                            <div>
                              <strong>Session ID:</strong> {session.id}
                            </div>
                            {rr && (
                              <>
                                <div>
                                  <strong>User:</strong> {rr.userId}
                                </div>
                                <div>
                                  <strong>Model Complexity:</strong> {rr.modelComplexity}
                                </div>
                                <div>
                                  <strong>Mirror Used:</strong> {rr.mirrorUsed ? 'Yes' : 'No'}
                                </div>
                                <div>
                                  <strong>Frame Count:</strong> {rr.frameCount}
                                </div>
                                <div>
                                  <strong>Detection Frames:</strong> {rr.detectionFrames}
                                </div>
                              </>
                            )}
                          </div>
                          {(detail?.summary || session.summary) && (
                            <div className="mt-4">
                              <strong className="text-neutral-300">Session Report:</strong>
                              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {(() => { const rep = (detail?.summary || session.summary); return rep?.summary ? (
                                  <div>
                                    <strong className="text-accent">Summary:</strong>
                                    <div className="text-neutral-500 text-xs mt-1">
                                      <div>Overall Score: {rep.summary.overallSessionScorecard || '—'}</div>
                                      <div>Reaction Speed: {rep.summary.reactionSpeed ? `${rep.summary.reactionSpeed}s` : '—'}</div>
                                      <div>Quality: {q}</div>
                                    </div>
                                  </div>
                                ) : null; })()}

                                {(() => { const rep = (detail?.summary || session.summary); return rep?.corePositionalMetrics ? (
                                  <div>
                                    <strong className="text-accent">Positional:</strong>
                                    <div className="text-neutral-500 text-xs mt-1">
                                      <div>Escapes: {rep.corePositionalMetrics.escapes?.attempts || 0} attempts, {rep.corePositionalMetrics.escapes?.successPercent || 0}% success</div>
                                      <div>Reversals: {rep.corePositionalMetrics.reversals?.count || 0} total, {rep.corePositionalMetrics.reversals?.successPercent || 0}% success</div>
                                    </div>
                                  </div>
                                ) : null; })()}

                                {rr && (rr.shoulderSym?.count || rr.kneeSym?.count) && (
                                  <div>
                                    <strong className="text-accent">Symmetry:</strong>
                                    <div className="text-neutral-500 text-xs mt-1">
                                      {rr.shoulderSym?.count ? (
                                        <div>Shoulder: {Math.round(rr.shoulderSym.mean)}° (±{Math.round(Math.sqrt(rr.shoulderSym.m2 / rr.shoulderSym.count))})</div>
                                      ) : null}
                                      {rr.kneeSym?.count ? (
                                        <div>Knee: {Math.round(rr.kneeSym.mean)}° (±{Math.round(Math.sqrt(rr.kneeSym.m2 / rr.kneeSym.count))})</div>
                                      ) : null}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <details className="mt-4">
                                <summary className="text-accent cursor-pointer hover:text-cyan-300">Full Report JSON</summary>
                                <pre className="text-[10px] text-neutral-500 mt-2 whitespace-pre-wrap overflow-auto max-h-64">
                                  {JSON.stringify(detail?.summary || session.summary, null, 2)}
                                </pre>
                              </details>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
