# Pose Landmarks Web Demo (Next.js)

MediaPipe Pose demo built with Next.js 14 + React 18 + Tailwind CSS. It runs Pose fully on-device in the browser (no backend) and displays real‑time landmarks plus simple session stats.

## Quick Start (Local Dev)

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Production Build / Preview

```bash
npm run build
npm start   # starts the standalone Next.js server on port 3000
```

## Deployment

### Vercel (Recommended)
1. Push this repository to GitHub (or GitLab/Bitbucket).
2. Import the project in Vercel – framework auto-detects: Next.js.
3. Build Command: `npm run build` (auto)
4. Output: `.next` (auto)
5. No extra config required. `output: 'standalone'` in `next.config.js` is already enabled.

### Netlify
1. Install dependency (local dev only) if you plan to run builds locally: `npm i -D @netlify/plugin-nextjs` (optional for simple deploy via UI if using standard adapter on Netlify infra).
2. Add/confirm `netlify.toml` (already provided or create) with:
	 ```toml
	 [build]
		 command = "npm run build"
		 publish = ".next"

	 [[plugins]]
		 package = "@netlify/plugin-nextjs"
	 ```
3. In Netlify UI: Build command = `npm run build`, Publish directory = `.next`.

### Environment Variables
None required currently. If you later add secrets, configure them in the Vercel / Netlify dashboard (never commit them).

### Standalone Output
`next.config.js` sets `output: 'standalone'` so the minimal server bundle lives under `.next/standalone`. This improves cold start performance on platforms that use Node serverless/edge functions.

## Project Structure
```
pages/        # Route pages (index, drill, home, profile)
components/   # Shared UI & state (Zustand stores, layout, session history)
lib/metrics/  # Session tracking & stats utilities
styles/       # Tailwind global styles
```

## Pose Implementation Notes
- Uses MediaPipe Pose via npm (camera_utils, drawing_utils, pose packages) loaded in the browser.
- Runs entirely client-side; you can enforce client-only execution with dynamic imports or `useEffect` where necessary to avoid SSR camera access errors.
- Canvas is mirrored by default (typical webcam UX). Provide a toggle if you need non-mirrored mode.

## Development Tips
- Use `npm run lint` before committing for basic checks.
- If you add heavy WASM/TF models later, consider dynamic imports to keep initial bundle small.

## License
MIT
