# Pose Landmarks Web Demo

A lightweight browser app that requests camera permission, runs MediaPipe Pose entirely on-device, and renders landmarks in real time with stats.

## How to run (localhost)

Option A: Python simple server,


option c , 
npm install
npm run build
npm ren dev


```bash
cd web/public
python3 -m http.server 8080
# Open http://localhost:8080 in your browser
```

Option B: Node http-server (if you have Node.js)

```bash
npm -g install http-server
cd web/public
http-server -p 8080 --cors
# Open http://localhost:8080
```

Then click "Enable Camera" and grant permission. Everything runs in your browser; no backend required.

## Notes
- Uses MediaPipe Solutions (Pose) via CDN for simplicity.
- The canvas is mirrored by default; toggle mirror off if you prefer non-mirrored.
- Adjust model complexity for performance/accuracy tradeoffs.