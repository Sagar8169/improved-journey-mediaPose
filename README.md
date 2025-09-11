# MediaPipe Pose Web Demo (Next.js)

A comprehensive pose detection web application built with Next.js 14, React 18, and MediaPipe Pose. This application provides real-time pose landmark detection, session tracking, and user authentication, all running entirely client-side in the browser.

## Features

- **Real-time Pose Detection**: Powered by MediaPipe Pose for accurate pose landmark detection
- **Session Tracking**: Monitor pose detection sessions with detailed statistics
- **User Authentication**: Built-in authentication system with profile management
- **Responsive Design**: Modern UI built with Tailwind CSS
- **Client-side Processing**: No backend required - all processing happens in the browser
- **TypeScript Support**: Full TypeScript implementation for better development experience

## Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Pose Detection**: MediaPipe Pose, Camera Utils, Drawing Utils
- **State Management**: Zustand
- **Build Tools**: PostCSS, Autoprefixer
- **Deployment**: Vercel, Netlify support

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

Currently, no environment variables are required for basic functionality. For future database integration, you may need:

```bash
# Copy and modify as needed
cp .env.example .env.local

# Example environment variables for database integration:
# DATABASE_URL=your_database_connection_string
# NEXTAUTH_SECRET=your_nextauth_secret
# NEXTAUTH_URL=http://localhost:3000
```

## Project Structure

```
├── pages/                 # Next.js pages and routing
│   ├── _app.tsx          # App wrapper and global providers
│   ├── index.tsx         # Landing page
│   ├── home.tsx          # Main pose detection interface
│   ├── drill.tsx         # Pose drill exercises
│   └── profile.tsx       # User profile management
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

The application includes a built-in authentication system:

- **Demo Account**: Email: `demo@jiujitsu.com`, Password: `demo123`
- **Signup/Login**: Create new accounts or login with existing credentials
- **Profile Management**: Update user information and settings
- **Session Persistence**: Maintains login state across browser sessions

**Note**: Current implementation uses in-memory storage. See [DEPLOYMENT.md](./DEPLOYMENT.md) for database integration options.

## Pose Detection Features

- **Real-time Processing**: Live pose detection from webcam feed
- **Landmark Visualization**: Visual overlay of pose landmarks and connections
- **Session Metrics**: Track detection accuracy, duration, and statistics
- **Multiple Views**: Different visualization modes for pose analysis

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
