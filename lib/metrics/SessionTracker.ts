import { SESSION_SCHEMA_VERSION, SEGMENT_MS, MIN_VALID_SESSION_SEC, MIN_DETECTION_RATE, SessionRecord, FrameUpdatePayload, SymmetryStats, JointAngleStats, GrapplingKPIs } from './types';
import { updateRunning } from './stats';
import { buildSessionReport } from './report';

export class SessionTracker {
  rec: SessionRecord;
  constructor(userId: string, modelComplexity: 0|1|2, mirror: boolean) {
    this.rec = {
      schemaVersion: SESSION_SCHEMA_VERSION,
      sessionId: crypto.randomUUID(),
      userId,
      startTs: Date.now(),
      frameCount: 0,
      modelComplexity,
      mirrorUsed: mirror,
      detectionFrames: 0,
      avgVisibilitySum: 0,
      bboxAreaSumPct: 0,
      bboxAreaSumSqPct: 0,
      postureIssues: 0,
      torsoAngleSum: 0,
      torsoAngleSumSq: 0,
      shoulderSym: { min: Infinity, max: -Infinity, mean: 0, m2: 0, count: 0 },
      kneeSym: { min: Infinity, max: -Infinity, mean: 0, m2: 0, count: 0 },
      jointStats: {},
      repsByMode: {},
      totalReps: 0,
      maxRepStreak: 0,
      currentStreak: 0,
      interruptions: 0,
      errors: [],
      segments: [],
      segActive: null,
      fpsSum: 0,
      fpsSumSq: 0,
      grappling: {
        controlTimeline: [],
        controlTimeByPos: {},
        submission: { attempts: 0, successes: 0 },
        escape: { attempts: 0, successes: 0 },
        transition: { attempts: 0, successes: 0 },
        takedown: { attempts: 0, successes: 0 },
        pass: { attempts: 0, successes: 0 },
        sweep: { attempts: 0, successes: 0 },
        scramble: { attempts: 0, wins: 0, losses: 0 },
        consistencyRating: undefined,
        intensityScore: 0,
        guardRetentionPct: 0,
        guardPassPreventionPct: 0,
        pressurePassingSuccessPct: 0,
        transitionEfficiencyPct: 0,
        technicalVarietyIdx: 0,
        winLossByPosition: {},
      } as GrapplingKPIs,
      firstPoseTs: undefined,
      lastBboxAreaPct: undefined,
      intensityEma: 0,
    };
  }
  private startSegment(now: number) {
    this.rec.segActive = { tStart: now, tEnd: now, reps: 0, postureIssues: 0 };
  }
  private rollSegment(now: number) {
    if (!this.rec.segActive) { this.startSegment(now); return; }
    const seg = this.rec.segActive;
    seg.tEnd = now;
    if (seg.tEnd - seg.tStart >= SEGMENT_MS) {
      this.rec.segments.push(seg);
      this.startSegment(now);
    }
  }
  updateFrame(p: FrameUpdatePayload) {
    const now = Date.now();
    this.rollSegment(now);
    this.rec.frameCount++;
    if (p.fps != null) { this.rec.fpsSum += p.fps; this.rec.fpsSumSq += p.fps * p.fps; }
    if (!p.hasPose) return;
    this.rec.detectionFrames++;

    // Reaction speed: time to first detected pose-based movement
    if (!this.rec.firstPoseTs) {
      this.rec.firstPoseTs = now;
      if (this.rec.grappling) this.rec.grappling.reactionTimeMs = now - this.rec.startTs; // time to first detected pose
    }
    if (this.rec.firstRepTs && this.rec.firstPoseTs && !this.rec.grappling?.reactionTimeMs) {
      // If reps exist (legacy), reuse as first movement; else approximate using detection start
      const rt = this.rec.firstRepTs - this.rec.firstPoseTs;
      if (rt > 0 && this.rec.grappling) this.rec.grappling.reactionTimeMs = rt;
    }

    // Rolling intensity proxy from bbox area delta and posture events (0-100)
    if (p.bboxAreaPct != null) {
      const prev = this.rec.lastBboxAreaPct ?? p.bboxAreaPct;
      const delta = Math.abs(p.bboxAreaPct - prev); // 0..1
      this.rec.lastBboxAreaPct = p.bboxAreaPct;
      // EMA with alpha tuned for ~2s horizon assuming ~30fps
      const alpha = 0.1;
      const scaled = Math.min(100, Math.max(0, delta * 4000)); // heuristic scale
      this.rec.intensityEma = this.rec.intensityEma == null ? scaled : (alpha * scaled + (1 - alpha) * (this.rec.intensityEma || 0));
      if (this.rec.grappling) this.rec.grappling.intensityScore = Math.round(this.rec.intensityEma);
    }

    if (p.visibilityAvg != null) this.rec.avgVisibilitySum += p.visibilityAvg;
    if (p.bboxAreaPct != null) { this.rec.bboxAreaSumPct += p.bboxAreaPct; this.rec.bboxAreaSumSqPct += p.bboxAreaPct * p.bboxAreaPct; }
    if (p.torsoAngle != null) { this.rec.torsoAngleSum += p.torsoAngle; this.rec.torsoAngleSumSq += p.torsoAngle * p.torsoAngle; }
    if (p.shoulderSym != null) this.updateSym('shoulderSym', p.shoulderSym);
    if (p.kneeSym != null) this.updateSym('kneeSym', p.kneeSym);
    if (p.jointAngles) {
      for (const [k,v] of Object.entries(p.jointAngles)) {
        if (v == null) continue;
        let js = this.rec.jointStats[k];
        if (!js) {
          js = { min: v, max: v, mean: v, m2: 0, count: 1 } as JointAngleStats;
          this.rec.jointStats[k] = js;
        } else {
          js.min = Math.min(js.min, v); js.max = Math.max(js.max, v);
          const u = updateRunning(js, v); js.mean = u.mean; js.m2 = u.m2; js.count = u.count;
        }
      }
    }
    if (p.postureIssue) {
      this.rec.postureIssues++;
      if (this.rec.segActive) this.rec.segActive.postureIssues++;
    }
    if (p.repIncrement && p.repMode) {
      this.rec.repsByMode[p.repMode] = (this.rec.repsByMode[p.repMode] || 0) + 1;
      this.rec.totalReps++;
      if (!this.rec.firstRepTs) this.rec.firstRepTs = now;
      this.rec.currentStreak++;
      this.rec.maxRepStreak = Math.max(this.rec.maxRepStreak, this.rec.currentStreak);
      if (this.rec.segActive) this.rec.segActive.reps++;
    }
  }
  private updateSym(key: 'shoulderSym'|'kneeSym', value: number) {
    const s = this.rec[key] as SymmetryStats;
    s.min = Math.min(s.min, value);
    s.max = Math.max(s.max, value);
    const u = updateRunning(s, value); s.mean = u.mean; s.m2 = u.m2; s.count = u.count;
  }
  interrupt() { this.rec.interruptions++; this.rec.currentStreak = 0; }
  finalize() {
    const end = Date.now();
    this.rec.endTs = end;
    this.rec.durationSec = (end - this.rec.startTs)/1000;
    if (this.rec.segActive) { this.rec.segActive.tEnd = end; if (this.rec.segActive.tEnd - this.rec.segActive.tStart > 1000) this.rec.segments.push(this.rec.segActive); }
    const detectionRate = this.rec.detectionFrames / Math.max(1, this.rec.frameCount);
    this.rec.detectionRate = detectionRate;
    this.rec.avgVisibility = this.rec.detectionFrames ? this.rec.avgVisibilitySum / this.rec.detectionFrames : 0;
    this.rec.formConsistencyScore = this.estimateFormScore();
    this.rec.focusScore = (this.rec.detectionRate || 0) * 100;
    // Map consistency to grappling rating for now
    if (this.rec.grappling) this.rec.grappling.consistencyRating = this.rec.formConsistencyScore;
    // Control time tracking (single generic position until classifier exists)
    if (this.rec.grappling) {
      const totalMs = Math.max(0, (this.rec.endTs || end) - this.rec.startTs);
      const activeMs = Math.round(totalMs * (this.rec.detectionRate || 0));
      this.rec.grappling.controlTimeByPos['Active Control'] = activeMs;
      this.rec.grappling.controlTimeline.push({ name: 'Active Control', confidence: 0.5, tStart: this.rec.startTs, tEnd: this.rec.endTs });
    }
    const quality: any = {};
    if ((this.rec.durationSec || 0) < MIN_VALID_SESSION_SEC) quality.short = true;
    if (detectionRate < MIN_DETECTION_RATE) quality.lowQuality = true;
    this.rec.qualityFlags = quality;
    this.rec.finalized = true;
    // Build the new Session Report JSON
    try {
      this.rec.report = buildSessionReport(this.rec, []);
    } catch (e:any) {
      this.rec.errors.push('report_build:' + (e?.message || String(e)));
    }
    return this.rec;
  }

  // Expose current grappling KPIs for live UI
  currentKPIs(): GrapplingKPIs | undefined {
    const g = this.rec.grappling; if (!g) return undefined;
    const now = Date.now();
    const durMs = now - this.rec.startTs;
    const activeMs = Math.round(durMs * (this.rec.detectionRate || (this.rec.frameCount ? this.rec.detectionFrames/this.rec.frameCount : 0)));
    const controlTimeByPos = { ...(g.controlTimeByPos || {}) };
    controlTimeByPos['Active Control'] = activeMs;
    return {
      ...g,
      controlTimeByPos,
      controlPercentPct: Math.round((activeMs / Math.max(1, durMs)) * 100),
      intensityScore: g.intensityScore ?? Math.round(this.rec.intensityEma || 0),
      consistencyRating: this.estimateFormScore(),
      reactionTimeMs: g.reactionTimeMs ?? (this.rec.firstPoseTs && this.rec.firstRepTs ? Math.max(0, this.rec.firstRepTs - this.rec.firstPoseTs) : undefined),
    };
  }
  private estimateFormScore() {
    const s = this.rec.shoulderSym; const k = this.rec.kneeSym;
    const shoulderVar = s.count>1? s.m2/(s.count-1):0;
    const kneeVar = k.count>1? k.m2/(k.count-1):0;
    const symVar = shoulderVar + kneeVar;
    const posturePenalty = Math.min(1, this.rec.postureIssues / Math.max(10, this.rec.durationSec || 1));
    const detect = this.rec.detectionRate || 0;
    const raw = 0.4*(1 - Math.min(1, symVar/400)) + 0.3*(detect) + 0.3*(1 - posturePenalty);
    return Math.round(raw * 100);
  }
}
