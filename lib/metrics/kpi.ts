import { RawEvent, Outcome, ScrambleWinner, PositionType } from './types';

export type KPIContext = {
  startAt: number;
  endAt?: number;
};

function pct(numer: number, denom: number): number {
  if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom <= 0) return 0;
  return Math.max(0, Math.min(100, (numer / denom) * 100));
}

export function computeControlTimePctByPosition(events: RawEvent[], ctx: KPIContext): Record<string, number> {
  const totalMs = Math.max(1, (ctx.endAt ?? Date.now()) - ctx.startAt);
  // Accumulate intervals between position_start/end per position
  const active: Map<PositionType, number> = new Map();
  const accum: Map<PositionType, number> = new Map();

  const sorted = [...events].sort((a,b)=> a.ts - b.ts);
  for (const ev of sorted) {
    if (ev.kind === 'position_start') {
      // close existing of same position if already open
      if (!active.has(ev.position)) active.set(ev.position, ev.ts);
    } else if (ev.kind === 'position_end') {
      const t0 = active.get(ev.position);
      if (t0 != null) {
        const prev = accum.get(ev.position) || 0;
        accum.set(ev.position, prev + Math.max(0, (ev.ts - t0)));
        active.delete(ev.position);
      }
    }
  }
  // Close any still-open intervals at endAt
  const endTs = ctx.endAt ?? Date.now();
  for (const [pos, t0] of active.entries()) {
    const prev = accum.get(pos) || 0;
    accum.set(pos, prev + Math.max(0, (endTs - t0)));
  }

  const out: Record<string, number> = {};
  for (const [pos, ms] of accum.entries()) {
    out[pos] = +pct(ms, totalMs).toFixed(2);
  }
  return out;
}

export function computeAttempts(events: RawEvent[], kindAttempt: RawEvent['kind'], kindResult: RawEvent['kind']): { attempts: number; successes: number } {
  let attempts = 0, successes = 0;
  for (const ev of events) {
    if (ev.kind === kindAttempt) attempts += 1;
    if (ev.kind === kindResult && (ev as any).outcome === 'success') successes += 1;
  }
  return { attempts, successes };
}

export function computeScramble(events: RawEvent[]): { attempts: number; wins: number; losses: number } {
  let attempts = 0, wins = 0, losses = 0;
  for (const ev of events) {
    if (ev.kind === 'scramble_start') attempts += 1;
    if (ev.kind === 'scramble_end') {
      if (ev.winner === 'self') wins += 1;
      else if (ev.winner === 'opponent') losses += 1;
    }
  }
  return { attempts, wins, losses };
}

export function computeAvgIntensity(events: RawEvent[]): number {
  const vals = events.filter(e=> e.kind==='intensity_sample') as Extract<RawEvent, {kind: 'intensity_sample'}>[];
  if (!vals.length) return 0;
  const avg0to1 = vals.reduce((a,b)=> a + (b.value||0), 0) / vals.length;
  return Math.round(avg0to1 * 100);
}

export function computeReactionAvg(events: RawEvent[]): number | undefined {
  const signals: Map<string, number> = new Map();
  const diffs: number[] = [];
  for (const ev of events) {
    if (ev.kind === 'reaction_signal') signals.set(ev.id, ev.ts);
    else if (ev.kind === 'reaction_move') {
      const t0 = signals.get(ev.id);
      if (t0 != null) diffs.push(ev.ts - t0);
    }
  }
  if (!diffs.length) return undefined;
  return Math.round(diffs.reduce((a,b)=>a+b,0) / diffs.length);
}

export function countTransitions(events: RawEvent[]): { total: number; success: number } {
  let total = 0, success = 0;
  for (const ev of events) {
    if (ev.kind === 'transition') {
      total += 1; if (ev.outcome === 'success') success += 1;
    }
  }
  return { total, success };
}
