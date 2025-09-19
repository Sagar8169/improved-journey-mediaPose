import { create } from 'zustand';
import { SessionTracker } from '@/lib/metrics/SessionTracker';
import { FrameUpdatePayload, SessionRecord, GrapplingKPIs } from '@/lib/metrics/types';

export interface SessionMetrics {
  totalReps: number;
  sessions: number;
  bestSymShoulder: number | null;
  bestSymKnee: number | null;
  postureIssues: number;
  lastUpdated: number | null;
  startedAt?: number | null; // timestamp of most recent session start
}

export interface SessionSummary {
  id: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  reps: number;
  postureIssues: number;
  bestSymShoulder: number | null;
  bestSymKnee: number | null;
}

interface State extends SessionMetrics {
  addSession: (partial?: Partial<SessionMetrics>) => void;
  addReps: (count: number) => void;
  addRep: () => void;
  considerSymmetry: (shoulder: number | null, knee: number | null) => void;
  recordPostureIssue: () => void;
  resetAll: () => void;
  // new session summary helpers
  activeSessionStart: number | null;
  sessionRecords: SessionSummary[];
  startSession: () => void;
  finalizeSession: (data: { reps: number; postureIssuesDelta: number; }) => SessionSummary | null;
  // enhanced tracking (Phase A+B)
  activeSessionTracker: SessionTracker | null;
  sessionHistory: SessionRecord[]; // detailed records
  startSessionTracking: (userId: string, modelComplexity: 0|1|2, mirror: boolean) => void;
  updateFrameMetrics: (payload: FrameUpdatePayload) => void;
  endSessionTracking: () => SessionRecord | null;
  clearSessionHistory: () => void;
  // Live KPI selector
  getLiveKPIs: () => GrapplingKPIs | undefined;
}

const initial: SessionMetrics = {
  totalReps: 0,
  sessions: 0,
  bestSymShoulder: null,
  bestSymKnee: null,
  postureIssues: 0,
  lastUpdated: null,
  startedAt: null,
};

export const usePoseStore = create<State>((set, get) => ({
  ...initial,
  activeSessionStart: null,
  sessionRecords: [],
  activeSessionTracker: null,
  sessionHistory: [],
  addSession: (partial) => set((s) => ({
    ...s,
    sessions: s.sessions + 1,
    startedAt: Date.now(),
    ...partial,
    lastUpdated: Date.now(),
  })),
  addReps: (count) => set((s) => ({
    totalReps: s.totalReps + count,
    lastUpdated: Date.now(),
  })),
  addRep: () => set((s) => ({
    totalReps: s.totalReps + 1,
    lastUpdated: Date.now(),
  })),
  considerSymmetry: (shoulder, knee) => set((s) => ({
    bestSymShoulder: (shoulder != null) ? (s.bestSymShoulder == null ? shoulder : Math.min(s.bestSymShoulder, shoulder)) : s.bestSymShoulder,
    bestSymKnee: (knee != null) ? (s.bestSymKnee == null ? knee : Math.min(s.bestSymKnee, knee)) : s.bestSymKnee,
    lastUpdated: Date.now(),
  })),
  recordPostureIssue: () => set((s) => ({ postureIssues: s.postureIssues + 1, lastUpdated: Date.now() })),
  resetAll: () => set({ ...initial, activeSessionStart: null, sessionRecords: [] }),
  startSession: () => set((s)=> s.activeSessionStart ? s : ({ activeSessionStart: Date.now(), startedAt: Date.now() })),
  finalizeSession: ({ reps, postureIssuesDelta }) => {
    let created: SessionSummary | null = null;
    set((s) => {
      if (!s.activeSessionStart) return s;
      const endedAt = Date.now();
      created = {
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        startedAt: s.activeSessionStart,
        endedAt,
        durationSec: (endedAt - s.activeSessionStart)/1000,
        reps,
        postureIssues: postureIssuesDelta,
        bestSymShoulder: s.bestSymShoulder,
        bestSymKnee: s.bestSymKnee,
      };
      return {
        ...s,
        activeSessionStart: null,
        sessionRecords: [created, ...s.sessionRecords].slice(0,100),
        sessions: s.sessions + 1,
        lastUpdated: Date.now(),
      };
    });
    return created;
  },
  // ---- Enhanced tracker API ----
  startSessionTracking: (userId, modelComplexity, mirror) => {
    if (get().activeSessionTracker) return;
    const tracker = new SessionTracker(userId, modelComplexity, mirror);
    set({ activeSessionTracker: tracker });
  },
  updateFrameMetrics: (payload) => {
    const tr = get().activeSessionTracker; if (!tr) return; tr.updateFrame(payload);
  },
  endSessionTracking: () => {
    const tr = get().activeSessionTracker; if (!tr) return null;
    const rec = tr.finalize();
    set(s => ({ activeSessionTracker: null, sessionHistory: [rec, ...s.sessionHistory].slice(0,100) }));
    return rec;
  },
  clearSessionHistory: () => set({ sessionHistory: [] }),
  getLiveKPIs: () => {
    const tr = get().activeSessionTracker; if (!tr) return undefined;
    return tr.currentKPIs();
  }
}));
