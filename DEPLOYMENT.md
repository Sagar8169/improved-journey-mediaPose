# Deployment Guide for MediaPipe Pose Web Demo

This comprehensive guide covers deploying the MediaPipe Pose application to various platforms, setting up databases, and configuring production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Integration](#database-integration)
4. [Deployment Platforms](#deployment-platforms)
5. [Security Considerations](#security-considerations)
6. [Monitoring and Analytics](#monitoring-and-analytics)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js**: Version 18.x or higher (but less than 21)
- **npm**: Version 8.x or higher
- **Git**: For version control and deployment
- **Modern Browser**: Chrome 88+, Firefox 85+, Safari 14+, Edge 88+

### Development Tools

```bash
# Verify Node.js version
node --version  # Should be 18.x or 19.x or 20.x

# Verify npm version
npm --version   # Should be 8.x or higher

# Global tools (optional but recommended)
npm install -g vercel       # For Vercel deployment
npm install -g netlify-cli  # For Netlify deployment
```

### Camera and HTTPS Requirements

- **Local Development**: HTTP is acceptable for localhost
- **Production**: HTTPS is mandatory for camera access
- **SSL Certificate**: Automatically handled by deployment platforms

## Environment Setup

### Local Environment Configuration

1. **Clone and Setup**:
   ```bash
   git clone https://github.com/maheshsharma-18/improved-journey-mediaPose.git
   cd improved-journey-mediaPose
   npm install
   ```

2. **Environment Variables**:
   ```bash
   # Create environment file
   touch .env.local
   ```

3. **Basic Environment Variables**:
   ```bash
   # .env.local
   
   # Application Configuration
   NEXT_PUBLIC_APP_NAME="MediaPipe Pose Demo"
   NEXT_PUBLIC_APP_VERSION="1.0.0"
   
   # Development vs Production
   NODE_ENV=development
   
   # Optional: Custom port for development
   PORT=3000
   
   # Optional: Enable debug mode
   DEBUG=false
   ```

### Production Environment Variables

```bash
# .env.production (for production builds)

# Application
NODE_ENV=production
NEXT_PUBLIC_APP_NAME="MediaPipe Pose Demo"

# Security
NEXTAUTH_SECRET=your-super-secret-key-here
NEXTAUTH_URL=https://your-domain.com

# Database (see Database Integration section)
DATABASE_URL=your-database-connection-string

# Optional: Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ANALYTICS_ENABLED=true

# Optional: Error Tracking
SENTRY_DSN=https://your-sentry-dsn
```

## Database Integration

The current application uses in-memory state management with Zustand. For production use, you'll want to integrate a persistent database.

### Option 1: PostgreSQL with Prisma

1. **Install Dependencies**:
   ```bash
   npm install prisma @prisma/client
   npm install -D prisma
   ```

2. **Initialize Prisma**:
   ```bash
   npx prisma init
   ```

3. **Database Schema** (`prisma/schema.prisma`):
   ```prisma
   generator client {
     provider = "prisma-client-js"
   }
   
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   
   model User {
     id        String   @id @default(cuid())
     email     String   @unique
     name      String
     password  String   // Hash this in production!
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
     sessions  Session[]
   }
   
   model Session {
     id            String   @id @default(cuid())
     userId        String
     user          User     @relation(fields: [userId], references: [id])
     duration      Int      // in milliseconds
     landmarks     Json     // Store pose landmarks
     accuracy      Float
     startedAt     DateTime
     completedAt   DateTime
     createdAt     DateTime @default(now())
   }
   ```

4. **Environment Configuration**:
   ```bash
   # .env.local
   DATABASE_URL="postgresql://username:password@localhost:5432/mediaposedb"
   ```

5. **Database Setup Commands**:
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Run migrations
   npx prisma migrate dev --name init
   
   # Seed database (optional)
   npx prisma db seed
   ```

### Option 2: MongoDB with Mongoose

1. **Install Dependencies**:
   ```bash
   npm install mongoose
   ```

2. **Database Connection** (`lib/mongodb.ts`):
   ```typescript
   import mongoose from 'mongoose';
   
   const MONGODB_URI = process.env.MONGODB_URI!;
   
   if (!MONGODB_URI) {
     throw new Error('Please define the MONGODB_URI environment variable');
   }
   
   let cached = (global as any).mongoose;
   
   if (!cached) {
     cached = (global as any).mongoose = { conn: null, promise: null };
   }
   
   async function dbConnect() {
     if (cached.conn) {
       return cached.conn;
     }
   
     if (!cached.promise) {
       const opts = {
         bufferCommands: false,
       };
   
       cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
         return mongoose;
       });
     }
     cached.conn = await cached.promise;
     return cached.conn;
   }
   
   export default dbConnect;
   ```

3. **User Model** (`models/User.ts`):
   ```typescript
   import mongoose, { Schema, models } from 'mongoose';
   
   const UserSchema = new Schema({
     email: { type: String, required: true, unique: true },
     name: { type: String, required: true },
     password: { type: String, required: true }, // Hash this!
     sessions: [{ type: Schema.Types.ObjectId, ref: 'Session' }]
   }, { timestamps: true });
   
   export default models.User || mongoose.model('User', UserSchema);
   ```

4. **Environment Configuration**:
   ```bash
   # .env.local
   MONGODB_URI=mongodb://localhost:27017/mediaposedb
   # Or for MongoDB Atlas:
   # MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mediaposedb
   ```

### Option 3: Supabase (Recommended for Quick Setup)

1. **Install Dependencies**:
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Supabase Configuration** (`lib/supabase.ts`):
   ```typescript
   import { createClient } from '@supabase/supabase-js';
   
   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
   const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
   
   export const supabase = createClient(supabaseUrl, supabaseAnonKey);
   ```

3. **Environment Configuration**:
   ```bash
   # .env.local
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Database Tables** (Run in Supabase SQL editor):
   ```sql
   -- Users table
   CREATE TABLE users (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     email VARCHAR(255) UNIQUE NOT NULL,
     name VARCHAR(255) NOT NULL,
     password_hash VARCHAR(255) NOT NULL,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Sessions table
   CREATE TABLE sessions (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES users(id),
     duration INTEGER NOT NULL,
     landmarks JSONB,
     accuracy FLOAT,
     started_at TIMESTAMP NOT NULL,
     completed_at TIMESTAMP NOT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Indexes for better performance
   CREATE INDEX idx_sessions_user_id ON sessions(user_id);
   CREATE INDEX idx_sessions_created_at ON sessions(created_at);
   ```

## Deployment Platforms

### Vercel (Recommended)

Vercel provides the easiest deployment experience for Next.js applications.

1. **Prerequisites**:
   - GitHub repository
   - Vercel account

2. **Automatic Deployment**:
   ```bash
   # Install Vercel CLI
   npm install -g vercel
   
   # Login to Vercel
   vercel login
   
   # Deploy
   vercel
   ```

3. **Manual Deployment via Dashboard**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure environment variables
   - Deploy

4. **Environment Variables Setup**:
   - Go to Project Settings → Environment Variables
   - Add all production environment variables
   - Ensure `NEXTAUTH_URL` matches your domain

5. **Custom Domain** (Optional):
   - Go to Project Settings → Domains
   - Add your custom domain
   - Configure DNS records as instructed

### Netlify

1. **Prerequisites**:
   - GitHub repository
   - Netlify account

2. **Deployment via CLI**:
   ```bash
   # Install Netlify CLI
   npm install -g netlify-cli
   
   # Login to Netlify
   netlify login
   
   # Build and deploy
   npm run build
   netlify deploy --prod --dir=.next
   ```

3. **Deployment via Dashboard**:
   - Go to [netlify.com](https://netlify.com)
   - Click "New site from Git"
   - Connect your repository
   - Build settings:
     - Build command: `npm run build`
     - Publish directory: `.next`

4. **Configuration** (`netlify.toml`):
   ```toml
   [build]
     command = "npm run build"
     publish = ".next"
   
   [[plugins]]
     package = "@netlify/plugin-nextjs"
   
   [build.environment]
     NODE_VERSION = "18"
   
   [[headers]]
     for = "/*"
     [headers.values]
       X-Frame-Options = "DENY"
       X-Content-Type-Options = "nosniff"
   ```

### Railway

1. **Prerequisites**:
   - GitHub repository
   - Railway account

2. **Deployment**:
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login and deploy
   railway login
   railway link
   railway up
   ```

3. **Configuration**:
   - Add environment variables in Railway dashboard
   - Set custom domain if needed

### DigitalOcean App Platform

1. **Create App**:
   - Go to DigitalOcean dashboard
   - Create new app from GitHub repository

2. **Configuration**:
   - Build command: `npm run build`
   - Run command: `npm start`
   - Environment variables: Add all required vars

### Self-Hosted (VPS/Dedicated Server)

1. **Server Setup** (Ubuntu/Debian):
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2 for process management
   sudo npm install -g pm2
   
   # Install Nginx for reverse proxy
   sudo apt install nginx
   ```

2. **Application Deployment**:
   ```bash
   # Clone repository
   git clone https://github.com/maheshsharma-18/improved-journey-mediaPose.git
   cd improved-journey-mediaPose
   
   # Install dependencies and build
   npm install
   npm run build
   
   # Start with PM2
   pm2 start npm --name "mediapipe-pose" -- start
   pm2 save
   pm2 startup
   ```

3. **Nginx Configuration** (`/etc/nginx/sites-available/mediapipe-pose`):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
   
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **SSL Certificate** (Let's Encrypt):
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

## Security Considerations

### Environment Variables Security

- **Never commit secrets** to version control
- Use different secrets for development and production
- Rotate secrets regularly
- Use strong, randomly generated secrets

### Authentication Security

1. **Password Hashing**:
   ```bash
   npm install bcryptjs
   ```

   ```typescript
   import bcrypt from 'bcryptjs';
   
   // Hash password before storing
   const hashedPassword = await bcrypt.hash(password, 12);
   
   // Verify password
   const isValid = await bcrypt.compare(password, hashedPassword);
   ```

2. **JWT Security**:
   ```typescript
   // Use strong secret
   const JWT_SECRET = process.env.NEXTAUTH_SECRET; // 32+ characters
   
   // Set appropriate expiration
   const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
   ```

### Content Security Policy

Add to `next.config.js`:
```javascript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';"
          }
        ]
      }
    ];
  }
};
```

### HTTPS Enforcement

1. **Vercel/Netlify**: Automatic HTTPS
2. **Self-hosted**: Use Let's Encrypt or CloudFlare

## Monitoring and Analytics

### Error Tracking with Sentry

1. **Setup**:
   ```bash
   npm install @sentry/nextjs
   ```

2. **Configuration** (`sentry.client.config.js`):
   ```javascript
   import * as Sentry from '@sentry/nextjs';
   
   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
   });
   ```

### Analytics with Google Analytics

1. **Setup**:
   ```bash
   npm install gtag
   ```

2. **Configuration** (`lib/gtag.ts`):
   ```typescript
   export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID;
   
   export const pageview = (url: string) => {
     window.gtag('config', GA_TRACKING_ID, {
       page_path: url,
     });
   };
   ```

### Performance Monitoring

1. **Web Vitals**:
   ```typescript
   // pages/_app.tsx
   export function reportWebVitals(metric: any) {
     console.log(metric);
     // Send to analytics service
   }
   ```

2. **Uptime Monitoring**:
   - Use services like UptimeRobot, Pingdom, or StatusCake
   - Monitor `/api/health` endpoint

## Troubleshooting

### Common Deployment Issues

1. **Build Failures**:
   ```bash
   # Clear cache and rebuild
   rm -rf .next node_modules package-lock.json
   npm install
   npm run build
   ```

2. **Environment Variable Issues**:
   - Ensure all required variables are set
   - Check variable names (no typos)
   - Restart deployment after adding variables

3. **Camera Access Issues**:
   - Verify HTTPS is enabled
   - Check browser permissions
   - Test on different devices/browsers

4. **Database Connection Issues**:
   ```bash
   # Test database connection
   npx prisma db push  # For Prisma
   # Or test with a simple connection script
   ```

### Performance Issues

1. **Slow Initial Load**:
   - Enable compression
   - Optimize images
   - Use CDN for static assets

2. **High Memory Usage**:
   - Monitor Node.js memory usage
   - Consider increasing server resources
   - Implement proper cleanup in pose detection

### Debug Mode

Enable detailed logging:
```bash
# .env.local
DEBUG=true
NEXT_PUBLIC_DEBUG=true
```

## Maintenance and Updates

### Regular Maintenance Tasks

1. **Update Dependencies**:
   ```bash
   npm audit
   npm update
   ```

2. **Monitor Logs**:
   ```bash
   # For PM2
   pm2 logs mediapipe-pose
   
   # For Vercel
   vercel logs
   ```

3. **Database Backups**:
   - Schedule regular backups
   - Test backup restoration process

4. **Security Updates**:
   - Monitor for security advisories
   - Update dependencies promptly
   - Review access logs

### Scaling Considerations

- **Horizontal Scaling**: Use load balancers for multiple instances
- **Database Scaling**: Consider read replicas for high traffic
- **CDN**: Use CloudFlare or AWS CloudFront for static assets
- **Caching**: Implement Redis for session storage

---

For additional help, refer to the main [README.md](./README.md) or create an issue on GitHub.