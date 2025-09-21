# MediaPose (Next.js + MediaPipe + MongoDB)

A production-ready pose training web app built with Next.js 14, React 18, and MediaPipe Pose. It provides real-time pose detection, live KPIs, and a secure server-backed authentication and session history with aggregated metrics persisted to MongoDB.

## Features

- Real-time pose detection (MediaPipe Pose) with overlay and voice cues
- Event-driven metrics pipeline v2: raw events in-memory; only aggregated report stored
- Secure auth: JWT access + rotating httpOnly Secure refresh cookies; email verification (Resend)
- Session history with 90-day TTL retention; paginated list and detail views
- Live KPIs panel during drills; finalize posts aggregated report only
- Responsive UI (Tailwind CSS) and full TypeScript codebase

## Technology Stack

- Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS
- Pose Detection: MediaPipe Pose, Camera Utils, Drawing Utils
- State: Zustand
- Backend: Next.js API routes (Netlify/Vercel serverless)
- Database: MongoDB Atlas
- Email: Resend

## Prerequisites

Before running this application, ensure you have:

- **Node.js**: Version 18 or higher (but less than 21)
- **npm**: Version 8 or higher
- **Modern Browser**: Chrome, Firefox, Safari, or Edge (latest versions)
- **Camera Access**: Webcam or device camera for pose detection
- **HTTPS**: Required for camera access in production (automatically handled by deployment platforms)

## Quick Start

### Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/maheshsharma-18/improved-journey-mediaPose.git
   cd improved-journey-mediaPose
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   ```
   http://localhost:3000
   ```

### Production Build

```bash
npm run build
npm start   # Starts the standalone Next.js server on port 3000
```

## Environment Variables

Server features (auth, email verification, session persistence) require environment variables. See `ENVIRONMENT.md` for the full list. Minimum for local dev with persistence:

```bash
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/rollmetric
MONGODB_DB_NAME=rollmetric
JWT_SECRET=your-256-bit-secret
JWT_REFRESH_SECRET=another-256-bit-secret
RESEND_API_KEY=re_xxx # optional for local dev if email not tested
EMAIL_FROM=no-reply@yourdomain.com
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NODE_ENV=development
```

You can still run the app without these to explore the UI, but session persistence and auth flows will be limited.

## Project Structure

```
├── pages/                 # Next.js pages and routing
│   ├── _app.tsx          # App wrapper and global providers
│   ├── index.tsx         # Landing page
│   ├── home.tsx          # Main pose detection interface
│   ├── drill.tsx         # Pose drill exercises
│   └── account.tsx       # User account management
├── components/           # Reusable React components
│   ├── Layout.tsx        # Main layout wrapper
│   ├── RequireAuth.tsx   # Authentication guard
│   ├── authStore.ts      # Zustand auth state management
│   ├── usePoseStore.ts   # Pose detection state
│   └── sessions/         # Session-related components
├── lib/                  # Utility functions and helpers
│   └── metrics/          # Session tracking and statistics
├── styles/               # Global styles and Tailwind config
├── public/               # Static assets
└── docs/                 # Documentation files
```

## Authentication System

Server-backed authentication with:
- Signup + email verification (Resend)
- Login issuing short-lived JWT access token and httpOnly Secure refresh cookie
- Refresh with rotation and reuse detection; logout revokes refresh
- Basic account overview and history pages

## Pose & Metrics Features

- Real-time processing and overlay of pose landmarks
- Live KPIs: control time %, attempts/success, scrambles, intensity, reaction
- Finalize builds an aggregated v2 `SessionReport` (schemaVersion=2)
- Server stores `report` (canonical) and `summary`; raw events are never uploaded

## Development

### Code Quality

```bash
# Run linting
npm run lint

# Type checking is automatic during build
npm run build
```

### Adding Features

1. **Components**: Add new React components in the `components/` directory
2. **Pages**: Create new pages in the `pages/` directory
3. **State**: Extend Zustand stores for new state management needs
4. **Styles**: Use Tailwind CSS classes for styling

## Browser Support

- **Chrome**: 88+ (recommended)
- **Firefox**: 85+
- **Safari**: 14+
- **Edge**: 88+

**Note**: Camera access requires HTTPS in production environments.

## Performance Considerations

- **Bundle Size**: MediaPipe libraries add ~3MB to the bundle
- **Memory Usage**: Pose detection uses moderate CPU/GPU resources
- **Camera Quality**: Higher resolution cameras provide better detection accuracy
- **Network**: Initial load requires downloading MediaPipe models (~10MB)

## Troubleshooting

### Common Issues

1. **Camera Not Working**:
   - Ensure HTTPS in production
   - Check browser permissions
   - Verify camera is not in use by another application

2. **Build Errors**:
   - Clear `.next` cache: `rm -rf .next`
   - Reinstall dependencies: `rm -rf node_modules package-lock.json && npm install`

3. **Performance Issues**:
   - Lower camera resolution
   - Close other browser tabs
   - Check GPU acceleration settings

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment-specific help
- Review the troubleshooting section above

## Session Report (Grappling) — v2

Finalized sessions include a `report` JSON object (canonical) and `summary`. Raw events are not persisted. `METRICS_SCHEMA_VERSION = 2`.

Open `/api/session-metrics` to view an example response shape.
