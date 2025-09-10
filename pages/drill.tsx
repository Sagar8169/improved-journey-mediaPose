import { useEffect, useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { RequireAuth } from '@/components/RequireAuth';
import { usePoseStore } from '@/components/usePoseStore';
import { useAuthStore } from '@/components/authStore';
import { useRouter } from 'next/router';

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
  const { currentUser } = useAuthStore();
  const router = useRouter();
  const postureStartRef = useRef(0);
  const sessionActiveRef = useRef(false);

  const lastTs = useRef<number>(performance.now());
  const poseRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const drawUtilsRef = useRef<{ drawConnectors: any; drawLandmarks: any; POSE_CONNECTIONS: any }|null>(null);
  const lastPostureIssueTs = useRef<number>(0);
  const modulesLoadedRef = useRef(false);

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

  const start = async () => {
    if (running) return;
    const video = videoRef.current!;
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
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
        modelComplexity: modelComplexity as 0|1|2,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      p.onResults(onResults);
      poseRef.current = p;
      modulesLoadedRef.current = true;
    } else {
      // update model complexity if changed during pause
      try { poseRef.current.setOptions({ modelComplexity: modelComplexity as 0|1|2 }); } catch {}
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
      if (currentUser) {
        store.startSessionTracking(currentUser.email, modelComplexity as 0|1|2, mirror);
      }
      postureStartRef.current = store.postureIssues;
      sessionActiveRef.current = true;
      setRepCount(0);
      setRepStage('-');
    }
  };

  const stop = (final=false) => {
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
      const postureDelta = store.postureIssues - postureStartRef.current;
      const rec = store.finalizeSession({ reps: repCount, postureIssuesDelta: postureDelta });
      const detailed = store.endSessionTracking();
      sessionActiveRef.current = false;
  // reset suggestions on full session end
  suggestionsShownRef.current.clear();
  if (suggestionTimeoutRef.current) { window.clearTimeout(suggestionTimeoutRef.current); suggestionTimeoutRef.current = null; }
  setSuggestion(null);
      if (rec) {
        router.push(`/profile?justSaved=${encodeURIComponent(rec.id)}`);
      }
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
    if (mirror) { ctx.translate(canvas.width,0); ctx.scale(-1,1); }
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
      }
    }

    // rep logic
    const updateRep = (newStage: string, inc: boolean) => {
      setRepStage(newStage);
      if (inc) {
        setRepCount(c=>{ store.addReps(1); return c+1; });
        store.updateFrameMetrics({ hasPose: true, repMode: repMode !== 'none'? repMode: undefined, repIncrement: true });
      }
    };

    const curlLogic = (a?: number) => { if(a==null) return; if(a>160) updateRep('down', false); if(a<40 && repStage==='down') updateRep('up', true); };
    const squatLogic = (k?: number) => { if(k==null) return; if(k>160) updateRep('up', false); if(k<100 && repStage==='up') updateRep('down', true); };
    const pushupLogic = (elL?: number, elR?: number) => { const a = (elL!=null && elR!=null) ? (elL+elR)/2 : (elL ?? elR); if(a==null)return; if(a>160) updateRep('up', false); if(a<80 && repStage==='up') updateRep('down', true); };
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
      if(!pt || val==null) return; const x = (mirror? (1-pt[0]) : pt[0]) * canvas.width; const y = pt[1]*canvas.height; ctx.fillStyle=color; ctx.font='12px sans-serif'; ctx.fillText(String(Math.round(val)), x+6, y-6);
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
  useEffect(()=>{ if(poseRef.current){ poseRef.current.setOptions({ modelComplexity }); } },[modelComplexity]);

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
      showSuggestion('Try back take from here');
    }
  },[repMode, detected, posture, running, suggestion]);

  // Cleanup timeout on unmount
  useEffect(()=>()=>{ if(suggestionTimeoutRef.current) window.clearTimeout(suggestionTimeoutRef.current); },[]);

  // position detection placeholder (future extension for grappling positions)
  const currentPosition = detected ? 'ACTIVE' : 'IDLE';
  const feedback = posture.includes('leaning') ? 'Posture adjustment needed' : (detected ? 'Good alignment' : 'No pose detected');

  return (
    <RequireAuth>
    <Layout>
      <main className="container-mobile flex flex-col items-center bg-bg text-brandText min-h-[calc(100svh-120px)] py-6">
        <div className="w-full max-w-4xl flex flex-col items-center">
          <div className="relative w-full aspect-video bg-panel rounded-xl overflow-hidden border border-accent/30">
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
            {!running && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg/80">
                <button onClick={start} className="btn-accent px-6 py-3 rounded-2xl font-medium">Enable Camera</button>
                <p className="text-xs text-brandText/60">Camera permission required to begin.</p>
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <p className="text-brandText/60 text-base md:text-lg">You're in</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-wide text-accent">{currentPosition}</h2>
            <p className={`font-medium mt-2 text-sm md:text-base ${feedback.includes('adjust') ? 'text-yellow-400' : feedback.includes('Good') ? 'text-accent' : 'text-brandText/50'}`}>{feedback}</p>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
            <button onClick={()=> running ? stop() : start()} className="btn-accent w-full sm:w-auto px-6 py-3 rounded-2xl text-base min-w-[140px]">{running? 'Pause':'Resume'}</button>
            <button onClick={()=> stop(true)} disabled={!sessionActiveRef.current} className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-base min-w-[140px]">End Session</button>
          </div>

          <div className="mt-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-panel rounded-lg p-4 border border-accent/20">
              <h3 className="text-sm font-semibold mb-3 tracking-wide text-brandText/70">Controls</h3>
              <div className="space-y-3 text-xs">
                <label className="flex items-center justify-between gap-4">Mirror
                  <input type="checkbox" className="accent-accent" checked={mirror} onChange={e=>setMirror(e.target.checked)} />
                </label>
                <label className="flex items-center justify-between gap-4">Model
                  <select value={modelComplexity} onChange={e=>setModelComplexity(Number(e.target.value))} className="bg-panel/60 rounded px-2 py-1 border border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/60">
                    <option value={0}>Lite</option>
                    <option value={1}>Full</option>
                    <option value={2}>Heavy</option>
                  </select>
                </label>
                <label className="flex items-center justify-between gap-4">Mode
                  <select value={repMode} onChange={e=>{ setRepMode(e.target.value); setRepStage('-'); setRepCount(0); }} className="bg-panel/60 rounded px-2 py-1 border border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/60 w-32">
                    <option value="none">None</option>
                    <option value="curlL">Curl L</option>
                    <option value="curlR">Curl R</option>
                    <option value="squat">Squat</option>
                    <option value="pushup">Push-up</option>
                    <option value="jack">Jack</option>
                  </select>
                </label>
                <div className="pt-2 grid grid-cols-2 gap-2 text-[11px] text-brandText/60">
                  <span>FPS: {fps.toFixed(1)}</span>
                  <span>Detected: {detected? 'yes':'no'}</span>
                  <span>Reps: {repCount}</span>
                  <span>Stage: {repStage}</span>
                </div>
              </div>
            </div>
            <div className="bg-panel rounded-lg p-4 border border-accent/20 md:col-span-2">
              <h3 className="text-sm font-semibold mb-3 tracking-wide text-brandText/70">Metrics</h3>
              <ul className="text-[11px] grid grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-3 leading-relaxed text-brandText/70">
                <li>Elbow L/R: {angles.elbowL?.toFixed(0) ?? '—'} / {angles.elbowR?.toFixed(0) ?? '—'}</li>
                <li>Knee L/R: {angles.kneeL?.toFixed(0) ?? '—'} / {angles.kneeR?.toFixed(0) ?? '—'}</li>
                <li>Shoulder L/R: {angles.shoulderL?.toFixed(0) ?? '—'} / {angles.shoulderR?.toFixed(0) ?? '—'}</li>
                <li>Hip L/R: {angles.hipL?.toFixed(0) ?? '—'} / {angles.hipR?.toFixed(0) ?? '—'}</li>
                <li>Torso: {angles.torso?.toFixed(0) ?? '—'}</li>
                <li>Sym sh/k: {angles.symShoulder?.toFixed(0) ?? '—'} / {angles.symKnee?.toFixed(0) ?? '—'}</li>
                <li>Avg vis: {avgVis?.toFixed(2) ?? '—'}</li>
                <li>BBox: {bbox? `${(bbox[0]*100).toFixed(0)}×${(bbox[1]*100).toFixed(0)}`:'—'}</li>
                <li className="col-span-2 md:col-span-3">Posture: {posture}</li>
              </ul>
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
  </Layout>
  </RequireAuth>
  );
}
