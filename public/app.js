// Simple browser app using MediaPipe Pose (Solutions API) with webcam

const videoEl = document.getElementById('video');
const canvasEl = document.getElementById('output');
const ctx = canvasEl.getContext('2d');

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const mirrorToggle = document.getElementById('mirrorToggle');
const modelComplexitySel = document.getElementById('modelComplexity');

const camStatus = document.getElementById('camStatus');
const fpsEl = document.getElementById('fps');
const detectedEl = document.getElementById('detected');
const landmarkCountEl = document.getElementById('landmarkCount');
const samplesEl = document.getElementById('samples');
// metrics UI
const angleElbowL = document.getElementById('angleElbowL');
const angleElbowR = document.getElementById('angleElbowR');
const angleKneeL = document.getElementById('angleKneeL');
const angleKneeR = document.getElementById('angleKneeR');
const angleTorso = document.getElementById('angleTorso');
const avgVisEl = document.getElementById('avgVis');
const angleShoulderL = document.getElementById('angleShoulderL');
const angleShoulderR = document.getElementById('angleShoulderR');
const angleHipL = document.getElementById('angleHipL');
const angleHipR = document.getElementById('angleHipR');
const deltaShoulderYEl = document.getElementById('deltaShoulderY');
const deltaHipYEl = document.getElementById('deltaHipY');
const bboxEl = document.getElementById('bbox');
const postureEl = document.getElementById('posture');
const symShoulderEl = document.getElementById('symShoulder');
const symKneeEl = document.getElementById('symKnee');
// reps UI
const repModeSel = document.getElementById('repMode');
const repStageEl = document.getElementById('repStage');
const repCountEl = document.getElementById('repCount');

let stream = null;
let camera = null; // MediaPipe camera wrapper
let pose = null;
let lastTs = performance.now();

// rep state
let repStage = '-';
let repCount = 0;

function setStatus(s) { camStatus.textContent = s; }

function resizeToVideo() {
  const w = videoEl.videoWidth;
  const h = videoEl.videoHeight;
  if (!w || !h) return;
  canvasEl.width = w;
  canvasEl.height = h;
}

function drawResults(results) {
  const w = canvasEl.width;
  const h = canvasEl.height;
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // Optional mirror for selfie view
  const mirror = mirrorToggle.checked;
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }

  // Draw the incoming video frame as the background
  ctx.drawImage(videoEl, 0, 0, w, h);

  // Draw landmarks (if present)
  const hasPose = !!results.poseLandmarks;
  detectedEl.textContent = hasPose ? 'yes' : 'no';
  landmarkCountEl.textContent = hasPose ? results.poseLandmarks.length : 0;

  if (hasPose) {
    // Use MediaPipe drawing utils
  drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS,
      { color: '#00C853', lineWidth: 3 });
  drawLandmarks(ctx, results.poseLandmarks,
      { color: '#FF6D00', lineWidth: 1, radius: 2 });

    // Show a few sample points
    const lms = results.poseLandmarks;
    const idx = {
      nose: 0,
      leftShoulder: 11,
      rightShoulder: 12,
      leftElbow: 13,
      rightElbow: 14,
      leftWrist: 15,
      rightWrist: 16,
      leftHip: 23,
      rightHip: 24,
      leftKnee: 25,
      rightKnee: 26,
      leftAnkle: 27,
      rightAnkle: 28,
    };
    const fmt = (p) => p ? `(${p.x.toFixed(3)}, ${p.y.toFixed(3)}) v=${p.visibility?.toFixed(2) ?? 'n/a'}` : '—';
    samplesEl.innerHTML = `
      <div><strong>Nose:</strong> ${fmt(lms[idx.nose])}</div>
      <div><strong>L. Shoulder:</strong> ${fmt(lms[idx.leftShoulder])}</div>
      <div><strong>R. Shoulder:</strong> ${fmt(lms[idx.rightShoulder])}</div>
      <div><strong>L. Elbow:</strong> ${fmt(lms[idx.leftElbow])}</div>
      <div><strong>R. Elbow:</strong> ${fmt(lms[idx.rightElbow])}</div>
      <div><strong>L. Wrist:</strong> ${fmt(lms[idx.leftWrist])}</div>
      <div><strong>R. Wrist:</strong> ${fmt(lms[idx.rightWrist])}</div>
      <div><strong>L. Hip:</strong> ${fmt(lms[idx.leftHip])}</div>
      <div><strong>R. Hip:</strong> ${fmt(lms[idx.rightHip])}</div>
    `;

    // --- Metrics ---
    const toXY = (p) => p ? [p.x, p.y] : null;
    const angle = (a, b, c) => {
      if (!a || !b || !c) return null;
      const ax = a[0] - b[0], ay = a[1] - b[1];
      const cx = c[0] - b[0], cy = c[1] - b[1];
      const a1 = Math.atan2(ay, ax);
      const a2 = Math.atan2(cy, cx);
      let deg = Math.abs((a2 - a1) * 180 / Math.PI);
      if (deg > 180) deg = 360 - deg;
      return deg;
    };

    const drawAngleOverlay = (pt, value, color = '#ffffff') => {
      if (!pt || value == null) return;
      const x = (mirrorToggle.checked ? (1 - pt[0]) : pt[0]) * w;
      const y = pt[1] * h;
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = '12px system-ui, sans-serif';
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 4;
      ctx.strokeText(String(Math.round(value)), x + 6, y - 6);
      ctx.fillText(String(Math.round(value)), x + 6, y - 6);
      ctx.restore();
    };

    const L = lms;
    const lShoulder = toXY(L[idx.leftShoulder]);
    const lElbow = toXY(L[idx.leftElbow]);
    const lWrist = toXY(L[idx.leftWrist]);
    const rShoulder = toXY(L[idx.rightShoulder]);
    const rElbow = toXY(L[idx.rightElbow]);
    const rWrist = toXY(L[idx.rightWrist]);
    const lHip = toXY(L[idx.leftHip]);
    const rHip = toXY(L[idx.rightHip]);
    const lKnee = toXY(L[idx.leftKnee]);
    const rKnee = toXY(L[idx.rightKnee]);
    const lAnkle = toXY(L[idx.leftAnkle]);
    const rAnkle = toXY(L[idx.rightAnkle]);

    const aElbowL = angle(lShoulder, lElbow, lWrist);
    const aElbowR = angle(rShoulder, rElbow, rWrist);
    const aKneeL = angle(lHip, lKnee, lAnkle);
    const aKneeR = angle(rHip, rKnee, rAnkle);

  // Shoulder joint angle (elbow-shoulder-hip)
  const aShoulderL = angle(lElbow, lShoulder, lHip);
  const aShoulderR = angle(rElbow, rShoulder, rHip);
  // Hip joint angle (shoulder-hip-knee)
  const aHipL = angle(lShoulder, lHip, lKnee);
  const aHipR = angle(rShoulder, rHip, rKnee);

    // Torso angle: angle between hip center -> shoulder center and horizontal
    const cShoulder = (lShoulder && rShoulder) ? [(lShoulder[0] + rShoulder[0]) / 2, (lShoulder[1] + rShoulder[1]) / 2] : null;
    const cHip = (lHip && rHip) ? [(lHip[0] + rHip[0]) / 2, (lHip[1] + rHip[1]) / 2] : null;
    let torsoAngle = null;
    if (cShoulder && cHip) {
      const dx = cShoulder[0] - cHip[0];
      const dy = cShoulder[1] - cHip[1];
      const rad = Math.atan2(dy, dx);
      torsoAngle = Math.abs(rad * 180 / Math.PI);
    }

    angleElbowL.textContent = aElbowL?.toFixed(0) ?? '—';
    angleElbowR.textContent = aElbowR?.toFixed(0) ?? '—';
    angleKneeL.textContent = aKneeL?.toFixed(0) ?? '—';
    angleKneeR.textContent = aKneeR?.toFixed(0) ?? '—';
    angleTorso.textContent = torsoAngle?.toFixed(0) ?? '—';
  angleShoulderL.textContent = aShoulderL?.toFixed(0) ?? '—';
  angleShoulderR.textContent = aShoulderR?.toFixed(0) ?? '—';
  angleHipL.textContent = aHipL?.toFixed(0) ?? '—';
  angleHipR.textContent = aHipR?.toFixed(0) ?? '—';

    // Average visibility
    const vis = L.map(p => typeof p.visibility === 'number' ? p.visibility : 0).filter(v => v >= 0);
    const avg = vis.length ? (vis.reduce((a, b) => a + b, 0) / vis.length) : null;
    avgVisEl.textContent = avg != null ? avg.toFixed(2) : '—';

    // Bounding box in relative coords and simple posture estimate
    const xs = L.map(p => p.x), ys = L.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const bw = Math.max(0, Math.min(1, maxX - minX));
    const bh = Math.max(0, Math.min(1, maxY - minY));
    bboxEl.textContent = `${(bw*100).toFixed(0)}×${(bh*100).toFixed(0)}`;

    // Shoulder/hip vertical delta (% of frame)
    let dShoulderY = null, dHipY = null;
    if (lShoulder && rShoulder) dShoulderY = Math.abs(lShoulder[1] - rShoulder[1]) * 100;
    if (lHip && rHip) dHipY = Math.abs(lHip[1] - rHip[1]) * 100;
    deltaShoulderYEl.textContent = dShoulderY != null ? dShoulderY.toFixed(1) : '—';
    deltaHipYEl.textContent = dHipY != null ? dHipY.toFixed(1) : '—';

    // Simple posture heuristic
    let posture = 'neutral';
    if (torsoAngle != null) {
      if (torsoAngle > 120 || torsoAngle < 60) posture = 'leaning';
      if (avg != null && avg < 0.5) posture = `${posture}, occluded`;
    }
    postureEl.textContent = posture;

    // Symmetry deltas
    const symShoulder = (aShoulderL != null && aShoulderR != null) ? Math.abs(aShoulderL - aShoulderR) : null;
    const symKnee = (aKneeL != null && aKneeR != null) ? Math.abs(aKneeL - aKneeR) : null;
    symShoulderEl.textContent = symShoulder != null ? symShoulder.toFixed(0) : '—';
    symKneeEl.textContent = symKnee != null ? symKnee.toFixed(0) : '—';

    // Angle overlays
    drawAngleOverlay(lElbow, aElbowL, '#e91e63');
    drawAngleOverlay(rElbow, aElbowR, '#e91e63');
    drawAngleOverlay(lKnee, aKneeL, '#03a9f4');
    drawAngleOverlay(rKnee, aKneeR, '#03a9f4');

    // --- Rep counter ---
    const mode = repModeSel.value;
    const updateUI = () => {
      repStageEl.textContent = repStage;
      repCountEl.textContent = String(repCount);
    };

    const curlLogic = (a) => {
      if (a == null) return;
      if (a > 160) repStage = 'down';
      if (a < 40 && repStage === 'down') { repStage = 'up'; repCount++; }
    };

    const squatLogic = (kneeAngle) => {
      if (kneeAngle == null) return;
      if (kneeAngle > 160) repStage = 'up'; // standing
      if (kneeAngle < 100 && repStage === 'up') { repStage = 'down'; repCount++; }
    };

    const pushupLogic = (elbowL, elbowR) => {
      const a = (elbowL != null && elbowR != null) ? (elbowL + elbowR) / 2 : (elbowL ?? elbowR);
      if (a == null) return;
      if (a > 160) repStage = 'up'; // arms extended
      if (a < 80 && repStage === 'up') { repStage = 'down'; repCount++; }
    };

    const jackLogic = (lW, rW, lA, rA) => {
      // jumping jack: hands above head and feet apart
      if (!lW || !rW || !lA || !rA) return;
      const handsUp = (lW[1] < (lShoulder?.[1] ?? 0.5)) && (rW[1] < (rShoulder?.[1] ?? 0.5));
      const feetApart = Math.abs(lA[0] - rA[0]) > 0.3; // generous threshold
      if (handsUp && feetApart) {
        if (repStage !== 'open') { repStage = 'open'; }
      } else {
        if (repStage === 'open') { repStage = 'closed'; repCount++; }
      }
    };

    switch (mode) {
      case 'curlL': curlLogic(aElbowL); break;
      case 'curlR': curlLogic(aElbowR); break;
      case 'squat': {
        // use min of knees to be stricter
        const k = (aKneeL != null && aKneeR != null) ? Math.min(aKneeL, aKneeR) : (aKneeL ?? aKneeR);
        squatLogic(k);
        break;
      }
  case 'pushup': pushupLogic(aElbowL, aElbowR); break;
  case 'jack': jackLogic(lWrist, rWrist, lAnkle, rAnkle); break;
      default: break;
    }
    updateUI();
  }

  ctx.restore();
}

function updateFps() {
  const now = performance.now();
  const dt = now - lastTs;
  lastTs = now;
  const fps = dt > 0 ? (1000 / dt) : 0;
  fpsEl.textContent = fps.toFixed(1);
}

async function ensurePose() {
  if (pose) return pose;
  return new Promise((resolve) => {
    const mpPose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });
    mpPose.setOptions({
      modelComplexity: Number(modelComplexitySel.value),
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    mpPose.onResults((results) => {
      resizeToVideo();
      drawResults(results);
      updateFps();
    });
    pose = mpPose;
    resolve(pose);
  });
}

async function startCamera() {
  if (stream) return; // already running
  setStatus('requesting');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
  } catch (e) {
    setStatus('permission denied');
    console.error('Camera error:', e);
    return;
  }

  videoEl.srcObject = stream;
  await videoEl.play();
  setStatus('running');
  resizeToVideo();

  const p = await ensurePose();
  camera = new Camera(videoEl, {
    onFrame: async () => {
      await p.send({ image: videoEl });
    },
    width: videoEl.videoWidth,
    height: videoEl.videoHeight,
  });
  camera.start();

  startBtn.disabled = true;
  stopBtn.disabled = false;
}

function stopCamera() {
  if (camera) {
    camera.stop();
    camera = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  setStatus('stopped');
  startBtn.disabled = false;
  stopBtn.disabled = true;
}

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
modelComplexitySel.addEventListener('change', () => {
  if (pose) {
    pose.setOptions({ modelComplexity: Number(modelComplexitySel.value) });
  }
});
mirrorToggle.addEventListener('change', () => {
  // Redraw on toggle
});
repModeSel.addEventListener('change', () => {
  // reset staging when changing mode
  repStage = '-';
  repCount = 0;
  repStageEl.textContent = repStage;
  repCountEl.textContent = String(repCount);
});

// Handle page visibility to save battery/cpu
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (camera) camera.stop();
  } else {
    if (stream && pose && camera) camera.start();
  }
});
