import React, { useMemo, useState, useEffect } from 'react';
import { sessions } from '@/lib/apiClient';
import { SessionSummary } from '@/lib/server/validation';
import { useAuth } from '@/components/useAuth';

function formatDuration(ms?: number) { 
  if (!ms && ms !== 0) return '—'; 
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60); 
  const s = sec % 60; 
  return `${m}m ${s}s`; 
}

function timeAgo(dateString: string) { 
  const d = Date.now() - new Date(dateString).getTime(); 
  const mins = Math.floor(d / 60000); 
  if (mins < 1) return 'just now'; 
  if (mins < 60) return mins + 'm ago'; 
  const hrs = Math.floor(mins / 60); 
  if (hrs < 24) return hrs + 'h ago'; 
  const days = Math.floor(hrs / 24); 
  return days + 'd ago'; 
}

export const SessionHistory = () => {
  const { isAuthenticated } = useAuth();
  const [sessions_data, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterLowQ, setFilterLowQ] = useState(true);
  const [page, setPage] = useState(1);
  
  const filtered = useMemo(() => 
    sessions_data.filter(s => filterLowQ ? s.qualityFlag !== 'low' : true), 
    [sessions_data, filterLowQ]
  );

  const loadSessions = async (pageNum: number = 1) => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await sessions.list({
        page: pageNum,
        limit: 20,
        hideLowQuality: filterLowQ
      });
      
      setSessions(response.sessions);
    } catch (error: any) {
      setError(error.message || 'Failed to load sessions');
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load sessions when component mounts or filters change
  useEffect(() => {
    loadSessions(page);
  }, [isAuthenticated, filterLowQ, page]);

  const viewSessionDetail = async (sessionId: string) => {
    if (expanded === sessionId) {
      setExpanded(null);
      return;
    }
    
    try {
      // For now just toggle expansion
      // In the future, we could load detailed data here
      setExpanded(sessionId);
    } catch (error) {
      console.error('Error loading session detail:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-xs text-neutral-500">
        Please log in to view your session history.
      </div>
    );
  }

  if (loading && sessions_data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent"></div>
        <span className="ml-2 text-xs text-neutral-500">Loading sessions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-400 bg-red-900/20 p-4 rounded border border-red-500/30">
        Error loading sessions: {error}
        <button 
          onClick={() => loadSessions(page)} 
          className="ml-2 text-accent hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!sessions_data.length) {
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
              onChange={e => {
                setFilterLowQ(e.target.checked);
                setPage(1);
              }} 
            />
            Hide Low Quality
          </label>
          <button
            onClick={() => loadSessions(page)}
            className="text-[11px] text-accent hover:underline"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full text-[11px]">
          <thead className="bg-neutral-900/70 text-neutral-400">
            <tr className="text-left">
              <th className="py-2 px-3">Time</th>
              <th className="py-2 px-3">Duration</th>
              <th className="py-2 px-3">Quality</th>
              <th className="py-2 px-3">Summary</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(session => (
              <React.Fragment key={session.id}>
                <tr className="border-t border-neutral-800 hover:bg-neutral-900/40">
                  <td className="py-2 px-3 whitespace-nowrap">{timeAgo(session.startAt)}</td>
                  <td className="py-2 px-3">{formatDuration(session.durationMs)}</td>
                  <td className="py-2 px-3">
                    {session.qualityFlag && (
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${
                        session.qualityFlag === 'low' 
                          ? 'bg-yellow-600/30 text-yellow-300' 
                          : session.qualityFlag === 'high'
                          ? 'bg-green-600/30 text-green-300'
                          : 'bg-neutral-700 text-neutral-300'
                      }`}>
                        {session.qualityFlag.toUpperCase()}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-neutral-400">
                    {session.summary ? (
                      <span className="truncate max-w-32">
                        {typeof session.summary === 'object' 
                          ? Object.keys(session.summary).length + ' metrics'
                          : 'Available'
                        }
                      </span>
                    ) : (
                      <span className="text-neutral-600">No summary</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button 
                      onClick={() => viewSessionDetail(session.id)} 
                      className="text-emerald-400 hover:text-cyan-300"
                    >
                      {expanded === session.id ? 'Hide' : 'View'}
                    </button>
                  </td>
                </tr>
                {expanded === session.id && (
                  <tr>
                    <td colSpan={5} className="px-3 pb-4 bg-neutral-900/20">
                      <div className="mt-2 p-3 bg-neutral-800/50 rounded text-xs">
                        <div className="grid grid-cols-2 gap-2 text-neutral-400">
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
                          {session.qualityFlag && (
                            <div>
                              <strong>Quality:</strong> {session.qualityFlag}
                            </div>
                          )}
                        </div>
                        {session.summary && (
                          <div className="mt-2 pt-2 border-t border-neutral-700">
                            <strong className="text-neutral-300">Summary:</strong>
                            <pre className="text-[10px] text-neutral-500 mt-1 whitespace-pre-wrap">
                              {JSON.stringify(session.summary, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
