import { useEffect, useRef, useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { RequireAuth } from '@/components/RequireAuth';
import { usePoseStore } from '@/components/usePoseStore';
import { useAuth } from '@/components/useAuth';
import { useRouter } from 'next/router';
import { createPortal } from 'react-dom';
import { sessions } from '@/lib/apiClient';
import { METRICS_SCHEMA_VERSION } from '@/lib/metrics/types';

// Lazy-load mediapipe libs (browser only)
const loadPoseStack = () => Promise.all([
  import('@mediapipe/pose'),
  import('@mediapipe/camera_utils'),
  import('@mediapipe/drawing_utils'),
]);

type PoseResults = any;

interface Angles {
  elbowL?: number; elbowR?: number; kneeL?: number; kneeR?: number;
  shoulderL?: number; shoulderR?: number; hipL?: number; hipR?: number; torso?: number;
  symShoulder?: number; symKnee?: number;
}

export default function DrillPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = useState(false);
  const [mirror, setMirror] = useState(true);
  // Camera facing: default to front camera for self-view on mobile
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  // If only one camera is available, block further flip attempts and show a notice prompting reload
  const [cameraSwitchBlocked, setCameraSwitchBlocked] = useState(false);
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);
  // Keep mirror state in a ref so the Mediapipe onResults callback always reads the latest value
  const mirrorRef = useRef(mirror);
  useEffect(()=>{ mirrorRef.current = mirror; }, [mirror]);
  const [modelComplexity, setModelComplexity] = useState(1);
  const [repMode, setRepMode] = useState('none');
  const [repStage, setRepStage] = useState('-');
  const [repCount, setRepCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [detected, setDetected] = useState(false);
  const [angles, setAngles] = useState<Angles>({});
  const [bbox, setBbox] = useState<[number, number] | null>(null);
  const [avgVis, setAvgVis] = useState<number | null>(null);
  const [posture, setPosture] = useState('—');
  const [samples, setSamples] = useState<any[]>([]);
  // Technique suggestion popup state
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const suggestionTimeoutRef = useRef<number | null>(null);
  const suggestionsShownRef = useRef<Set<string>>(new Set());

  const store = usePoseStore();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const postureStartRef = useRef(0);
  const sessionActiveRef = useRef(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const lastTs = useRef<number>(performance.now());
  const poseRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const drawUtilsRef = useRef<{ drawConnectors: any; drawLandmarks: any; POSE_CONNECTIONS: any }|null>(null);
  const lastPostureIssueTs = useRef<number>(0);
  const modulesLoadedRef = useRef(false);

  // ---------------- Control Menu State ----------------
  type Skill = 'Beginner' | 'Intermediate' | 'Advanced' | 'Competition-Level' | 'Custom';
  const [controlsOpen, setControlsOpen] = useState(false);
  const [skill, setSkill] = useState<Skill>('Intermediate');
  // Focus areas
  const attackDefault = { Mount:false, 'Back Control':false, 'Side Control':false, 'Knee-on-Belly':false, 'North-South':false, 'Guard (Attacking Guard)':false } as const;
  const defenseDefault = { 'Bottom Mount':false, 'Back Mount (Back Control)':false, 'Bottom Side Control':false, 'Bottom Knee-on-Belly':false, 'Bottom North-South':false, 'Turtle Position':false, 'Bottom of a Takedown Attempt':false, 'Guard (Defensive Guard Under Strikes)':false } as const;
  const [focusAttack, setFocusAttack] = useState<{[K in keyof typeof attackDefault]: boolean}>({...attackDefault});
  const [focusDefense, setFocusDefense] = useState<{[K in keyof typeof defenseDefault]: boolean}>({...defenseDefault});
  const focusAllSelected = useMemo(()=> Object.values(focusAttack).every(Boolean) && Object.values(focusDefense).every(Boolean), [focusAttack, focusDefense]);
  const toggleFocusAll = (value: boolean) => { setFocusAttack(Object.fromEntries(Object.keys(attackDefault).map(k=>[k, value])) as any); setFocusDefense(Object.fromEntries(Object.keys(defenseDefault).map(k=>[k, value])) as any); };
  // Voice cues
  type CueType = 'Technical Guidance' | 'Positional Prompts' | 'Motivational Coaching';
  type CueFreq = 'Smart Mode' | 'Every 30 Seconds' | 'Only on Position Change' | 'End of Round Only';
  type CueStyle = 'Neutral Instructor' | 'Encouraging Coach' | 'Quiet Mode';
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [cueType, setCueType] = useState<CueType>('Technical Guidance');
  const [cueFreq, setCueFreq] = useState<CueFreq>('Smart Mode');
  const [cueStyle, setCueStyle] = useState<CueStyle>('Neutral Instructor');
  // Training goals
  const goalsDefault = { 'Improve Submissions':false, 'Escape Bad Positions':false, 'Sharpen Transitions':false, 'Build Positional Control':false, 'Prepare for Sparring or Competition':false, 'Self-Defense Fundamentals':false } as const;
  const [goals, setGoals] = useState<{[K in keyof typeof goalsDefault]: boolean}>({...goalsDefault});
  const goalsAllSelected = useMemo(()=> Object.values(goals).every(Boolean), [goals]);
  const toggleGoalsAll = (value:boolean) => setGoals(Object.fromEntries(Object.keys(goalsDefault).map(k=>[k, value])) as any);

  // Voice synthesis helper
  const speak = (text: string) => {
    if (!voiceEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    switch(cueStyle){
      case 'Neutral Instructor': utter.rate = 1.0; utter.pitch = 1.0; break;
      case 'Encouraging Coach': utter.rate = 1.05; utter.pitch = 1.1; break;
      case 'Quiet Mode': utter.rate = 0.95; utter.pitch = 0.95; break;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  // Derive model and thresholds from skill level
  const skillDerived = useMemo(()=>{
    switch(skill){
      case 'Beginner': return { mc: 0 as 0|1|2, det: 0.4, track: 0.4, curlUp: 45, curlDown: 160, squatDown: 100, pushDown: 85 };
      case 'Intermediate': return { mc: 1 as 0|1|2, det: 0.5, track: 0.5, curlUp: 40, curlDown: 160, squatDown: 100, pushDown: 80 };
      case 'Advanced': return { mc: 1 as 0|1|2, det: 0.6, track: 0.6, curlUp: 35, curlDown: 165, squatDown: 95, pushDown: 75 };
      case 'Competition-Level': return { mc: 2 as 0|1|2, det: 0.7, track: 0.7, curlUp: 30, curlDown: 170, squatDown: 90, pushDown: 70 };
      case 'Custom': default: return { mc: (modelComplexity as 0|1|2), det: 0.5, track: 0.5, curlUp: 40, curlDown: 160, squatDown: 100, pushDown: 80 };
    }
  }, [skill, modelComplexity]);

  const applyPoseOptions = (p: any) => {
    try { p.setOptions({ modelComplexity: skillDerived.mc, minDetectionConfidence: skillDerived.det, minTrackingConfidence: skillDerived.track }); } catch {}
  };

  // metrics helpers
  const angle = (a?: number[], b?: number[], c?: number[]) => {
    if (!a || !b || !c) return undefined;
    const ax = a[0] - b[0], ay = a[1] - b[1];
    const cx = c[0] - b[0], cy = c[1] - b[1];
    const a1 = Math.atan2(ay, ax);
    const a2 = Math.atan2(cy, cx);
    let deg = Math.abs((a2 - a1) * 180 / Math.PI);
    if (deg > 180) deg = 360 - deg;
    return deg;
  };

  // Start camera/pose pipeline. Optional facing override for internal restarts.
  const start = async (facingOverride?: 'user'|'environment') => {
    if (running) return;
    const video = videoRef.current!;
    try {
      const desiredFacing = facingOverride ?? cameraFacing;
      // Prefer requested facing. If it fails, try alternate, then generic fallback.
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: desiredFacing } as any, audio: false });
      } catch (err1) {
        const alt: 'user'|'environment' = desiredFacing === 'user' ? 'environment' : 'user';
        try {
          console.warn('Preferred camera failed, trying alternate:', alt, err1);
          streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: alt } as any, audio: false });
          setCameraFacing(alt);
        } catch (err2) {
          console.warn('Alternate camera failed, trying default constraints', err2);
          streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }
    } catch (e) {
      console.error('camera error', e);
      return;
    }
    video.srcObject = streamRef.current;
    await video.play();
    if (!modulesLoadedRef.current || !poseRef.current) {
      const [poseModule, cameraModule, drawingModule] = await loadPoseStack();
      const { Pose, POSE_CONNECTIONS } = poseModule;
      const { Camera } = cameraModule as any;
      const { drawConnectors, drawLandmarks } = drawingModule;
      drawUtilsRef.current = { drawConnectors, drawLandmarks, POSE_CONNECTIONS };
      const p = new Pose({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
      p.setOptions({
        modelComplexity: skillDerived.mc,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: skillDerived.det,
        minTrackingConfidence: skillDerived.track,
      });
      p.onResults(onResults);
      poseRef.current = p;
      modulesLoadedRef.current = true;
    } else {
      // update model complexity if changed during pause
  try { applyPoseOptions(poseRef.current); } catch {}
    }
    // Always recreate camera after pause
    const { Camera } = (await import('@mediapipe/camera_utils')) as any;
    const cam = new Camera(video, {
      onFrame: async () => { if (poseRef.current) await poseRef.current.send({ image: video }); },
      width: video.videoWidth,
      height: video.videoHeight,
    });
    cameraRef.current = cam;
    cam.start();
    setRunning(true);
    if (!sessionActiveRef.current) {
      store.startSession(); // legacy simple summary
      // Always start local tracking for live KPIs, even if not authenticated
      store.startSessionTracking(currentUser?.email ?? 'guest', skillDerived.mc, mirror);
      // If authenticated, also create a server-side session for persistence
      if (currentUser) {
        try {
          const sessionResponse = await sessions.start({
            drillType: 'pose-detection',
            deviceInfo: {
              userAgent: navigator.userAgent,
              timestamp: new Date().toISOString(),
            },
            startAt: new Date().toISOString(),
          });
          setCurrentSessionId(sessionResponse.sessionId);
        } catch (error) {
          console.error('Failed to start session:', error);
        }
      }
      postureStartRef.current = store.postureIssues;
      sessionActiveRef.current = true;
      setRepCount(0);
      setRepStage('-');
    }
  };

  const stop = async (final=false) => {
    cameraRef.current?.stop();
    cameraRef.current = null;
    if (final) {
      try { poseRef.current?.close?.(); } catch {}
      poseRef.current = null;
      modulesLoadedRef.current = false;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setRunning(false);
    if (final && sessionActiveRef.current) {
      // End-of-round voice cue
      if (voiceEnabled && cueFreq === 'End of Round Only') {
        const msg = cueType === 'Motivational Coaching' ? `Round complete. ${repCount} reps. Great work.` : cueType === 'Positional Prompts' ? `Round complete. Review your control and transitions.` : `Round complete. Reps: ${repCount}. Check posture notes.`;
        speak(msg);
      }
      const postureDelta = store.postureIssues - postureStartRef.current;
      const rec = store.finalizeSession({ reps: repCount, postureIssuesDelta: postureDelta });
      const detailed = store.endSessionTracking();
      sessionActiveRef.current = false;
      
      // Save to database if we have a session ID
      if (currentSessionId && detailed) {
        try {
          // Prefer v2 aggregated report payload; do not send raw details
          const aggregated = {
            schemaVersion: METRICS_SCHEMA_VERSION,
            report: detailed.report ?? null,
            // For now, reuse report as summary to minimize server computation
            summary: detailed.report ?? null,
          } as Record<string, any>;
          await sessions.finish(currentSessionId, {
            finalizedReport: aggregated,
            endAt: new Date().toISOString(),
          });
          console.log('Session saved to database:', currentSessionId);
        } catch (error) {
          console.error('Failed to save session to database:', error);
        }
      }
      
      // reset suggestions on full session end
      suggestionsShownRef.current.clear();
      if (suggestionTimeoutRef.current) { window.clearTimeout(suggestionTimeoutRef.current); suggestionTimeoutRef.current = null; }
      setSuggestion(null);
      
      // Clear session state
      setCurrentSessionId(null);
      
      if (rec) {
        router.push(`/account?justSaved=${encodeURIComponent(rec.id)}`);
      }
    }
  };

  // Toggle between front/back cameras. If running, restart stream with new facing.
  const toggleCameraFacing = async () => {
    if (cameraSwitchBlocked) return;
    
    console.log('Camera toggle requested. Current facing:', cameraFacing);
    
    // Check available cameras before attempting to switch
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      console.log('Available video devices:', videoInputs.length, videoInputs);
      
      if (videoInputs.length <= 1) {
        setCameraNotice('No other camera was found on this device. Please reload the page and try again.');
        setCameraSwitchBlocked(true);
        console.warn('Only one camera found, blocking switch');
        return;
      }
    } catch (e) {
      // If enumeration fails, proceed with existing toggle logic as a best-effort
      console.warn('enumerateDevices failed; proceeding with toggle', e);
    }
    
    const next: 'user'|'environment' = cameraFacing === 'user' ? 'environment' : 'user';
    console.log('Switching camera to:', next);
    setCameraFacing(next);
    
    // Do not auto-toggle mirror; keep user preference stable across camera changes.
    if (running) {
      // Gracefully stop without tearing down Pose, then restart with the next facing.
      try { 
        console.log('Restarting camera with new facing...');
        stop(false); 
      } catch (e) {
        console.warn('Error stopping camera:', e);
      }
      await start(next);
      console.log('Camera restart complete');
    }
  };

  const onResults = (results: PoseResults) => {
  const canvas = canvasRef.current;
  const video = videoRef.current;
  if (!canvas || !video) return; // component not ready or unmounted
  const ctx = canvas.getContext('2d');
  if (!ctx) return; // context unavailable (rare)

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.save();
    ctx.clearRect(0,0,canvas.width, canvas.height);
  if (mirrorRef.current) { ctx.translate(canvas.width,0); ctx.scale(-1,1); }
    try {
      ctx.drawImage(video, 0,0, canvas.width, canvas.height);
    } catch {
      ctx.restore();
      return;
    }

    const lms = results.poseLandmarks as any[] | undefined;
    const hasPose = !!lms;
    setDetected(hasPose);
    if (!lms) { ctx.restore(); return; }

    // Draw skeleton overlay
    if (drawUtilsRef.current) {
      const { drawConnectors, drawLandmarks, POSE_CONNECTIONS } = drawUtilsRef.current;
  // Use brand accent + light landmarks for consistency with dark theme
  drawConnectors(ctx, lms, POSE_CONNECTIONS, { color: '#58A6FF', lineWidth: 3 });
  drawLandmarks(ctx, lms, { color: '#F0F6FC', lineWidth: 1, radius: 2 });
    }

    const idx: Record<string, number> = { nose:0, leftShoulder:11,rightShoulder:12,leftElbow:13,rightElbow:14,leftWrist:15,rightWrist:16,leftHip:23,rightHip:24,leftKnee:25,rightKnee:26,leftAnkle:27,rightAnkle:28 };
    const toXY = (p?: any) => p ? [p.x, p.y] : undefined;

    const lShoulder = toXY(lms[idx.leftShoulder]);
    const rShoulder = toXY(lms[idx.rightShoulder]);
    const lElbow = toXY(lms[idx.leftElbow]);
    const rElbow = toXY(lms[idx.rightElbow]);
    const lWrist = toXY(lms[idx.leftWrist]);
    const rWrist = toXY(lms[idx.rightWrist]);
    const lHip = toXY(lms[idx.leftHip]);
    const rHip = toXY(lms[idx.rightHip]);
    const lKnee = toXY(lms[idx.leftKnee]);
    const rKnee = toXY(lms[idx.rightKnee]);
    const lAnkle = toXY(lms[idx.leftAnkle]);
    const rAnkle = toXY(lms[idx.rightAnkle]);

    const elbowL = angle(lShoulder,lElbow,lWrist);
    const elbowR = angle(rShoulder,rElbow,rWrist);
    const kneeL = angle(lHip,lKnee,lAnkle);
    const kneeR = angle(rHip,rKnee,rAnkle);
    const shoulderL = angle(lElbow,lShoulder,lHip);
    const shoulderR = angle(rElbow,rShoulder,rHip);
    const hipL = angle(lShoulder,lHip,lKnee);
    const hipR = angle(rShoulder,rHip,rKnee);

    const cShoulder = (lShoulder && rShoulder) ? [(lShoulder[0]+rShoulder[0])/2,(lShoulder[1]+rShoulder[1])/2]: undefined;
    const cHip = (lHip && rHip) ? [(lHip[0]+rHip[0])/2,(lHip[1]+rHip[1])/2]: undefined;
    let torso: number | undefined;
    if (cShoulder && cHip) {
      const dx = cShoulder[0]-cHip[0];
      const dy = cShoulder[1]-cHip[1];
      torso = Math.abs(Math.atan2(dy,dx)*180/Math.PI);
    }

    const vis = lms.map(p => typeof p.visibility==='number'?p.visibility:0).filter(v=>v>=0);
    const avg = vis.length? vis.reduce((a,b)=>a+b,0)/vis.length : null;
    setAvgVis(avg);

    const xs = lms.map(p=>p.x), ys = lms.map(p=>p.y);
    const bw = Math.max(0,Math.min(1, Math.max(...xs)-Math.min(...xs)));
    const bh = Math.max(0,Math.min(1, Math.max(...ys)-Math.min(...ys)));
    setBbox([bw,bh]);

    let postureStr = 'neutral';
    if (torso != null) {
      if (torso > 120 || torso < 60) postureStr = 'leaning';
      if (avg != null && avg < 0.5) postureStr += ', occluded';
    }
    setPosture(postureStr);

    const symShoulder = (shoulderL!=null && shoulderR!=null)? Math.abs(shoulderL-shoulderR): undefined;
    const symKnee = (kneeL!=null && kneeR!=null)? Math.abs(kneeL-kneeR): undefined;

    setAngles({ elbowL, elbowR, kneeL, kneeR, shoulderL, shoulderR, hipL, hipR, torso, symShoulder, symKnee });
    store.considerSymmetry(symShoulder ?? null, symKnee ?? null);
    if (postureStr.includes('leaning')) {
      const nowTs = Date.now();
      if (nowTs - lastPostureIssueTs.current > 1000) { // 1s cooldown
        store.recordPostureIssue();
        lastPostureIssueTs.current = nowTs;
        if (voiceEnabled && (cueFreq === 'Smart Mode' || cueFreq === 'Only on Position Change')) {
          const msg = cueType === 'Motivational Coaching' ? 'Chest up, you got this.' : 'Keep your back tall and neutral.';
          speak(msg);
        }
      }
    }

    // rep logic
    const updateRep = (newStage: string, inc: boolean) => {
      setRepStage(newStage);
      if (inc) {
        setRepCount(c=>{ store.addReps(1); return c+1; });
        store.updateFrameMetrics({ hasPose: true, repMode: repMode !== 'none'? repMode: undefined, repIncrement: true });
        // Smart/position voice feedback on rep increment
        if (voiceEnabled && (cueFreq === 'Smart Mode' || cueFreq === 'Only on Position Change')) {
          const msg = cueType === 'Motivational Coaching' ? 'Nice rep, keep tempo steady.' : cueType === 'Positional Prompts' ? 'Finish strong, lock the position.' : 'Control your form on the way up.';
          speak(msg);
        }
      }
    };

    const curlLogic = (a?: number) => { if(a==null) return; if(a>skillDerived.curlDown) updateRep('down', false); if(a<skillDerived.curlUp && repStage==='down') updateRep('up', true); };
    const squatLogic = (k?: number) => { if(k==null) return; if(k>160) updateRep('up', false); if(k<skillDerived.squatDown && repStage==='up') updateRep('down', true); };
    const pushupLogic = (elL?: number, elR?: number) => { const a = (elL!=null && elR!=null) ? (elL+elR)/2 : (elL ?? elR); if(a==null)return; if(a>160) updateRep('up', false); if(a<skillDerived.pushDown && repStage==='up') updateRep('down', true); };
    const jackLogic = (lW?: number[], rW?: number[], lA?: number[], rA?: number[]) => {
      if(!lW||!rW||!lA||!rA) return; const handsUp = (lW[1] < (lShoulder?.[1] ?? 0.5)) && (rW[1] < (rShoulder?.[1] ?? 0.5)); const feetApart = Math.abs(lA[0]-rA[0])>0.3; if(handsUp && feetApart){ if(repStage!=='open') updateRep('open', false);} else { if(repStage==='open') updateRep('closed', true);} };

    switch(repMode){
      case 'curlL': curlLogic(elbowL); break;
      case 'curlR': curlLogic(elbowR); break;
      case 'squat': {
        const k = (kneeL!=null && kneeR!=null)? Math.min(kneeL,kneeR) : (kneeL ?? kneeR);
        squatLogic(k); break;
      }
      case 'pushup': pushupLogic(elbowL, elbowR); break;
      case 'jack': jackLogic(lWrist, rWrist, lAnkle, rAnkle); break;
    }

    // crude text overlays for angles
    const drawAngle = (pt?: number[], val?: number, color='#fff') => {
      // Note: When mirroring, the canvas context itself is flipped. Use raw pt[0] here so text aligns with landmarks.
      if(!pt || val==null) return; const x = pt[0] * canvas.width; const y = pt[1]*canvas.height; ctx.fillStyle=color; ctx.font='12px sans-serif'; ctx.fillText(String(Math.round(val)), x+6, y-6);
    };
  const angleColor = '#58A6FF';
  drawAngle(lElbow, elbowL, angleColor);
  drawAngle(rElbow, elbowR, angleColor);
  drawAngle(lKnee, kneeL, angleColor);
  drawAngle(rKnee, kneeR, angleColor);

    ctx.restore();

    // push frame metrics to tracker (non-rep increment path)
    store.updateFrameMetrics({
      hasPose,
      visibilityAvg: avg ?? undefined,
      bboxAreaPct: (bw && bh) ? (bw*bh) : undefined,
      torsoAngle: torso,
      shoulderSym: symShoulder,
      kneeSym: symKnee,
      jointAngles: { elbowL, elbowR, kneeL, kneeR, shoulderL, shoulderR, hipL, hipR, torso },
      fps,
      postureIssue: postureStr.includes('leaning'),
      repMode: repMode !== 'none' ? repMode : undefined,
      repIncrement: false,
    });

    // fps
    const now = performance.now();
    const dt = now - lastTs.current; lastTs.current = now; setFps(dt>0? 1000/dt:0);
  };

  useEffect(()=>{ return ()=>{ stop(); }; },[]);
  useEffect(()=>{ if(poseRef.current){ try { poseRef.current.setOptions({ modelComplexity: skillDerived.mc, minDetectionConfidence: skillDerived.det, minTrackingConfidence: skillDerived.track }); } catch {} } },[skillDerived]);
  // Scroll lock when controls modal is open
  useEffect(()=>{
    if (typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    if (controlsOpen) document.body.style.overflow = 'hidden';
    return ()=> { document.body.style.overflow = prev; };
  }, [controlsOpen]);
  // Close modal on Escape
  useEffect(()=>{
    if (!controlsOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setControlsOpen(false); };
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  }, [controlsOpen]);

  // Show a technique suggestion overlay (large, readable) for a few seconds
  const showSuggestion = (text: string) => {
    if (suggestionsShownRef.current.has(text)) return; // prevent repeats per session
    suggestionsShownRef.current.add(text);
    setSuggestion(text);
    if (suggestionTimeoutRef.current) window.clearTimeout(suggestionTimeoutRef.current);
    suggestionTimeoutRef.current = window.setTimeout(()=>{ setSuggestion(null); }, 6000);
  };

  // Rep milestone suggestions
  useEffect(()=>{
    if(!running) return;
    if(repCount === 5){
      switch(repMode){
        case 'curlL':
        case 'curlR': showSuggestion('Slow eccentric curls now'); break;
        case 'squat': showSuggestion('Try a jump squat progression'); break;
        case 'pushup': showSuggestion('Add a shoulder tap variation'); break;
        case 'jack': showSuggestion('Increase tempo slightly'); break;
      }
    }
  },[repCount, repMode, running]);

  // Neutral posture idle suggestion (example: "Try back take from here")
  useEffect(()=>{
    if(!running) return;
    if(repMode==='none' && detected && posture==='neutral' && !suggestion){
      const focusSelected = Object.entries({ ...focusAttack, ...focusDefense }).filter(([,v])=>v).map(([k])=>k);
      const goalSelected = Object.entries(goals).filter(([,v])=>v).map(([k])=>k);
      const hint = focusSelected[0] || goalSelected[0] || 'transition to back control';
      showSuggestion(typeof hint === 'string' ? `Consider a ${hint}` : 'Try back take from here');
    }
  },[repMode, detected, posture, running, suggestion, focusAttack, focusDefense, goals]);

  // Cleanup timeout on unmount
  useEffect(()=>()=>{ if(suggestionTimeoutRef.current) window.clearTimeout(suggestionTimeoutRef.current); },[]);

  // position detection placeholder (future extension for grappling positions)
  const currentPosition = detected ? 'ACTIVE' : 'IDLE';
  const feedback = posture.includes('leaning') ? 'Posture adjustment needed' : (detected ? 'Good alignment' : 'No pose detected');

  // Derive a simple pose name for the mobile top status section
  const poseName = useMemo(() => {
    if (!detected) return 'No Pose Detected';
    switch (repMode) {
      case 'curlL': return 'Bicep Curl (Left)';
      case 'curlR': return 'Bicep Curl (Right)';
      case 'squat': return 'Squat';
      case 'pushup': return 'Push-up';
      case 'jack': return 'Jumping Jacks';
      default: return 'Idle';
    }
  }, [detected, repMode]);

  // Voice Cues: every 30 seconds
  useEffect(()=>{
    if (!voiceEnabled || !running) return;
    if (cueFreq !== 'Every 30 Seconds') return;
    const id = window.setInterval(()=>{
      const focusSelected = Object.entries({ ...focusAttack, ...focusDefense }).filter(([,v])=>v).map(([k])=>k);
      const goalSelected = Object.entries(goals).filter(([,v])=>v).map(([k])=>k);
      const hint = focusSelected[0] || goalSelected[0] || (repMode !== 'none' ? repMode : 'movement');
      let msg = 'Stay consistent.';
      if (cueType === 'Technical Guidance') msg = `Check form on your ${hint}.`;
      else if (cueType === 'Positional Prompts') msg = `Think about controlling ${hint}.`;
      else msg = 'Great pace, keep breathing.';
      speak(msg);
    }, 30000);
    return ()=> window.clearInterval(id);
  }, [voiceEnabled, running, cueFreq, cueType, focusAttack, focusDefense, goals, repMode]);

  // Voice Cues: only on position change
  const prevPostureRef = useRef<string>('—');
  const prevStageRef = useRef<string>('-');
  useEffect(()=>{
    if (!voiceEnabled) return;
    if (cueFreq !== 'Only on Position Change') return;
    if (posture !== prevPostureRef.current || repStage !== prevStageRef.current) {
      prevPostureRef.current = posture;
      prevStageRef.current = repStage;
      const msg = posture.includes('leaning') ? 'Fix posture now.' : (repStage === '-' ? 'Getting into position.' : `Stage: ${repStage}.`);
      speak(msg);
    }
  }, [voiceEnabled, cueFreq, posture, repStage]);

  return (
    <RequireAuth>
    <Layout>
      <main className="container-mobile flex flex-col items-center bg-bg text-brandText min-h-[100svh] py-4 sm:py-6">
        <div className="w-full max-w-4xl flex flex-col items-center">
          {/* Top Status Bar: pose name on left, camera toggle icon on right */}
          <div className="w-full flex items-center justify-between px-2 sm:px-0 mb-3 sm:mb-4">
            <div className="flex flex-col">
              <span className="text-sm text-brandText/60">Status</span>
              <span className={`text-lg font-semibold ${!detected ? 'text-brandText/50' : posture.includes('leaning') ? 'text-yellow-400' : 'text-accent'}`}>{poseName}</span>
            </div>
            <button
              onClick={toggleCameraFacing}
              disabled={cameraSwitchBlocked}
              aria-label="Toggle front/back camera"
              className="p-2 rounded-xl bg-panel border border-accent/40 text-brandText/80 hover:bg-panel/70 disabled:opacity-40"
              title="Switch Camera"
            >
              {/* Camera-switch icon (inline SVG) */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 7h7l2-2h1a2 2 0 012 2v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17 17H10l-2 2H7a2 2 0 01-2-2V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 11l-2 2-2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 13l-2-2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Center: Live camera feed with overlay, mobile-first aspect */}
          <div className="relative w-full aspect-[9/16] md:aspect-video bg-panel rounded-xl overflow-hidden border border-accent/30">
            <video ref={videoRef} playsInline className="w-full h-full object-cover hidden" />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            {suggestion && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="bg-black/60 px-8 py-6 rounded-2xl border border-accent/40 shadow-2xl max-w-[80%]">
                  <p className="text-3xl md:text-5xl font-bold tracking-wide text-white text-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] leading-tight">
                    {suggestion}
                  </p>
                </div>
              </div>
            )}
            {cameraNotice && (
              <div className="absolute inset-0 flex items-center justify-center z-30">
                <div className="bg-black/70 px-6 py-5 rounded-2xl border border-accent/40 shadow-2xl max-w-[85%] text-center">
                  <p className="text-white text-base md:text-lg mb-4">{cameraNotice}</p>
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={()=> window.location.reload()} className="btn-accent px-4 py-2 rounded-xl">Reload Page</button>
                  </div>
                </div>
              </div>
            )}
            {!running && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg/80">
                <button onClick={()=> start()} className="btn-accent px-6 py-3 rounded-2xl font-medium">Enable Camera</button>
                <p className="text-xs text-brandText/60">Camera permission required to begin.</p>
              </div>
            )}
          </div>

          {/* Bottom Controls */}
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
            <button onClick={()=> running ? stop() : start()} className="btn-accent w-full sm:w-auto px-6 py-3 rounded-2xl text-base min-w-[140px]">{running? 'Pause':'Resume'}</button>
            <button onClick={()=> stop(true)} disabled={!sessionActiveRef.current} className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-base min-w-[140px]">End Session</button>
            <button onClick={()=> setControlsOpen(true)} className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-panel border border-accent/40 hover:bg-panel/70 text-base min-w-[140px]">Controls</button>
          </div>

          {/* KPIs and Debug */}
          <div className="mt-8 sm:mt-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-panel rounded-lg p-4 border border-accent/20 md:col-span-3">
              <h3 className="text-sm font-semibold mb-3 tracking-wide text-brandText/70">key performance indicator</h3>
              {(() => {
                const kpis = store.getLiveKPIs();
                const pct = (num?: number, den?: number) => {
                  if (num==null) return '—';
                  if (den!=null && den>0) return `${Math.round((num/den)*100)}%`;
                  if (typeof num === 'number' && num>=0 && num<=1) return `${Math.round(num*100)}%`;
                  return `${Math.round(num)}%`;
                };
                const get = (v?: number) => v==null? '—' : String(Math.round(v));
                const controlPct = kpis?.controlPercentPct != null ? `${Math.round(kpis.controlPercentPct)}%` : '—';
                const wlByPos = kpis?.winLossByPosition || {};
                const wlStr = Object.keys(wlByPos).length ? Object.entries(wlByPos).map(([p,wl])=> {
                  const wlo = wl as { wins?: number; losses?: number };
                  return `${p}: ${wlo.wins ?? 0}-${wlo.losses ?? 0}`;
                }).join(', ') : '—';
                return (
                  <ul className="text-[11px] grid grid-cols-1 md:grid-cols-3 gap-y-1 gap-x-3 leading-relaxed text-brandText/70">
                    <li>Positional Control Time %: {controlPct}</li>
                    <li>Submission Attempts & Success %: {(kpis?.submission?.attempts ?? 0)}/{pct(kpis?.submission?.successes ?? 0, kpis?.submission?.attempts ?? 0)}</li>
                    <li>Escape Attempts & Success %: {(kpis?.escape?.attempts ?? 0)}/{pct(kpis?.escape?.successes ?? 0, kpis?.escape?.attempts ?? 0)}</li>
                    <li>Guard Retention %: {pct(kpis?.guardRetentionPct ?? 0)}</li>
                    <li>Transition Efficiency %: {pct(kpis?.transitionEfficiencyPct ?? 0)}</li>
                    <li>Takedown Success %: {pct(kpis?.takedown?.successes ?? 0, kpis?.takedown?.attempts ?? 0)}</li>
                    <li>Pressure Passing Success %: {pct(kpis?.pressurePassingSuccessPct ?? 0)}</li>
                    <li>Scramble Win %: {(() => { const s = kpis?.scramble; return s? pct(s.wins ?? 0, ((s.wins ?? 0)+(s.losses ?? 0))||0): '—'; })()}</li>
                    <li>Positional Error Trends: {kpis?.positionalErrorTrend ?? '—'}</li>
                    <li>Session Consistency Rating: {get(kpis?.consistencyRating)}</li>
                    <li>Endurance / Fatigue Indicators: {kpis?.enduranceFatigue?.fatigueTrend ?? '—'}</li>
                    <li>Technical Variety Index: {get(kpis?.technicalVarietyIdx)}</li>
                    <li>Win/Loss Ratio by Position: {wlStr}</li>
                    <li>Rolling Intensity Score: {get(kpis?.intensityScore)}</li>
                    <li>Reaction Speed (ms): {get(kpis?.reactionTimeMs)}</li>
                    <li>Sweep Success %: {pct(kpis?.sweep?.successes ?? 0, kpis?.sweep?.attempts ?? 0)}</li>
                    <li>Guard Pass Prevention Rate: {pct(kpis?.guardPassPreventionPct ?? 0)}</li>
                    <li>Recovery Time Between Rounds (ms): {get(kpis?.recoveryTimeMs)}</li>
                  </ul>
                );
              })()}
            </div>
            <div className="bg-panel rounded-lg p-4 border border-accent/20 md:col-span-3">
              <h3 className="text-sm font-semibold mb-2 tracking-wide text-brandText/70">Samples (debug)</h3>
              <div className="text-[10px] font-mono space-y-1 max-h-40 overflow-auto pr-2 text-brandText/60">
                {samples.length? samples.map((s,i)=>(<div key={i}>{s}</div>)) : <div className="text-brandText/40">—</div>}
              </div>
              <p className="mt-3 text-[10px] text-brandText/40">Processing happens locally in your browser.</p>
            </div>
          </div>
        </div>
      </main>
      {typeof window !== 'undefined' && controlsOpen && createPortal(
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/60" onClick={()=> setControlsOpen(false)} />
          <div role="dialog" aria-modal="true" className="absolute inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-3xl w-full bg-panel border border-accent/30 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-6 max-h-[80svh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-brandText">Control Menu</h3>
                <button onClick={()=> setControlsOpen(false)} className="px-3 py-1 rounded-lg bg-panel/60 border border-accent/30 text-brandText/80 hover:bg-panel/80">Close</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className="bg-bg/40 rounded-xl p-4 border border-accent/20">
                  <h4 className="text-sm font-semibold mb-3 text-brandText/80">Basics</h4>
                  <div className="space-y-3 text-sm">
                    {/* Mirror flips the entire canvas context horizontally; drawing code uses raw landmark coords to avoid double flips */}
                    <label className="flex items-center justify-between gap-4">Mirror
                      <input aria-label="Mirror video horizontally" type="checkbox" className="accent-accent" checked={mirror} onChange={e=>setMirror(e.target.checked)} />
                    </label>
                    <label className="flex items-center justify-between gap-4">Skill Level
                      <select value={skill} onChange={e=> setSkill(e.target.value as any)} className="bg-panel/60 rounded px-2 py-1 border border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/60 w-40">
                        <option>Beginner</option>
                        <option>Intermediate</option>
                        <option>Advanced</option>
                        <option>Competition-Level</option>
                        <option>Custom</option>
                      </select>
                    </label>
                    {skill === 'Custom' && (
                      <label className="flex items-center justify-between gap-4">Model Complexity
                        <select value={modelComplexity} onChange={e=>setModelComplexity(Number(e.target.value))} className="bg-panel/60 rounded px-2 py-1 border border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/60 w-40">
                          <option value={0}>Lite</option>
                          <option value={1}>Full</option>
                          <option value={2}>Heavy</option>
                        </select>
                      </label>
                    )}
                  </div>
                </section>

                <section className="bg-bg/40 rounded-xl p-4 border border-accent/20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-brandText/80">Focus Areas</h4>
                    <label className="text-xs flex items-center gap-2"><input type="checkbox" className="accent-accent" checked={focusAllSelected} onChange={e=> toggleFocusAll(e.target.checked)} /> Select All</label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-brandText/60 mb-2">Attacking</p>
                      <div className="space-y-2">
                        {Object.keys(focusAttack).map(k=> (
                          <label key={k} className="flex items-center gap-2 text-[12px]"><input type="checkbox" className="accent-accent" checked={(focusAttack as any)[k]} onChange={e=> setFocusAttack(v=> ({...v, [k]: e.target.checked} as any))} /> {k}</label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-brandText/60 mb-2">Defensive</p>
                      <div className="space-y-2">
                        {Object.keys(focusDefense).map(k=> (
                          <label key={k} className="flex items-center gap-2 text-[12px]"><input type="checkbox" className="accent-accent" checked={(focusDefense as any)[k]} onChange={e=> setFocusDefense(v=> ({...v, [k]: e.target.checked} as any))} /> {k}</label>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="bg-bg/40 rounded-xl p-4 border border-accent/20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-brandText/80">Voice Cues</h4>
                    <label className="text-xs flex items-center gap-2"><input type="checkbox" className="accent-accent" checked={voiceEnabled} onChange={e=> setVoiceEnabled(e.target.checked)} /> Enable</label>
                  </div>
                  <div className="space-y-3 text-sm">
                    <label className="flex items-center justify-between gap-4">Type
                      <select disabled={!voiceEnabled} value={cueType} onChange={e=> setCueType(e.target.value as any)} className="bg-panel/60 rounded px-2 py-1 border border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/60 w-44 disabled:opacity-50">
                        <option>Technical Guidance</option>
                        <option>Positional Prompts</option>
                        <option>Motivational Coaching</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-4">Frequency
                      <select disabled={!voiceEnabled} value={cueFreq} onChange={e=> setCueFreq(e.target.value as any)} className="bg-panel/60 rounded px-2 py-1 border border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/60 w-44 disabled:opacity-50">
                        <option>Smart Mode</option>
                        <option>Every 30 Seconds</option>
                        <option>Only on Position Change</option>
                        <option>End of Round Only</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-4">Style
                      <select disabled={!voiceEnabled} value={cueStyle} onChange={e=> setCueStyle(e.target.value as any)} className="bg-panel/60 rounded px-2 py-1 border border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/60 w-44 disabled:opacity-50">
                        <option>Neutral Instructor</option>
                        <option>Encouraging Coach</option>
                        <option>Quiet Mode</option>
                      </select>
                    </label>
                    <p className="text-xs text-brandText/50">Speech uses your browser's voice. Ensure system sound is on.</p>
                  </div>
                </section>

                <section className="bg-bg/40 rounded-xl p-4 border border-accent/20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-brandText/80">Training Goals</h4>
                    <label className="text-xs flex items-center gap-2"><input type="checkbox" className="accent-accent" checked={goalsAllSelected} onChange={e=> toggleGoalsAll(e.target.checked)} /> Select All</label>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-[12px]">
                    {Object.keys(goals).map(k=> (
                      <label key={k} className="flex items-center gap-2"><input type="checkbox" className="accent-accent" checked={(goals as any)[k]} onChange={e=> setGoals(v=> ({...v, [k]: e.target.checked} as any))} /> {k}</label>
                    ))}
                  </div>
                </section>
              </div>

              <div className="mt-6 flex justify-end">
                <button onClick={()=> setControlsOpen(false)} className="btn-accent px-5 py-2 rounded-xl">Done</button>
              </div>
            </div>
          </div>
  </div>, document.body)}
  </Layout>
  </RequireAuth>
  );
}
