# Backend Requirements for MediaPipe Pose Application

## Overview
This document outlines the backend requirements for a simple yet effective MediaPipe Pose web application supporting 30-50 users per month with basic user management, email verification, and session tracking.

## Simplified Requirements Summary

### Core Features Needed
- User registration with email verification
- Simple email/password login
- Store user profiles and session metrics only
- MongoDB Atlas free tier (512MB storage limit)
- Support for 30-50 users per month

## Database Requirements

### 1. MongoDB Collections Design

#### 1.1 Users Collection
```javascript
// users
{
  _id: ObjectId,
  email: String, // unique, required
  name: String, // required
  password: String, // bcrypt hashed
  isEmailVerified: Boolean, // default false
  emailVerificationToken: String, // temporary token
  emailVerificationExpires: Date,
  resetPasswordToken: String, // optional, for password reset
  resetPasswordExpires: Date,
  createdAt: Date,
  updatedAt: Date,
  lastLoginAt: Date,
  isActive: Boolean // default true
}

// Index
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "emailVerificationToken": 1 })
db.users.createIndex({ "resetPasswordToken": 1 })
```

#### 1.2 Sessions Collection
```javascript
// sessions
{
  _id: ObjectId,
  userId: ObjectId, // reference to users
  sessionId: String, // matches client SessionRecord.sessionId
  startTimestamp: Date,
  endTimestamp: Date,
  durationSeconds: Number,
  modelComplexity: Number, // 0, 1, or 2
  mirrorUsed: Boolean,
  frameCount: Number,
  detectionFrames: Number,
  detectionRate: Number,
  
  // Session Metrics (embedded document)
  metrics: {
    totalReps: Number,
    postureIssues: Number,
    shoulderSymmetry: {
      min: Number,
      max: Number,
      mean: Number,
      variance: Number
    },
    kneeSymmetry: {
      min: Number,
      max: Number,
      mean: Number,
      variance: Number
    },
    intensityScore: Number,
    formScore: Number,
    interruptions: Number,
    fpsStats: {
      average: Number,
      variance: Number
    }
  },
  
  // Grappling Metrics (if applicable)
  grapplingMetrics: {
    positionSpans: Array, // position tracking data
    controlTimes: Object, // time in different positions
    transitionEfficiency: Number,
    submissionAttempts: Number,
    submissionSuccesses: Number,
    scrambleFrequency: Number,
    reactionTimeMs: Number,
    guardRetentionPct: Number,
    technicalVarietyIndex: Number
  },
  
  createdAt: Date
}

// Index
db.sessions.createIndex({ "userId": 1, "createdAt": -1 })
db.sessions.createIndex({ "sessionId": 1 }, { unique: true })
```

## Authentication & Security

### 2.1 Email Verification Flow
```javascript
// Registration process
1. User submits: { name, email, password }
2. Check if email already exists
3. Hash password with bcrypt (10 rounds for efficiency)
4. Generate email verification token (crypto.randomBytes(32))
5. Save user with isEmailVerified: false
6. Send verification email
7. User clicks link → verify email → isEmailVerified: true

// Login process
1. Check email exists and isEmailVerified: true
2. Compare password with bcrypt
3. Generate JWT token
4. Update lastLoginAt
5. Return user profile + token
```

### 2.2 JWT Configuration
```javascript
// Simple JWT payload
{
  userId: String,
  email: String,
  iat: Number,
  exp: Number // 24 hours expiry for simplicity
}

// Password requirements (keep it simple)
- Minimum 6 characters
- At least one letter and one number
```

## API Endpoints (Minimal Set)

### 3.1 Authentication Endpoints
```javascript
POST /api/auth/register
Body: { name: String, email: String, password: String }
Response: { success: Boolean, message: String }

GET /api/auth/verify-email/:token
Response: { success: Boolean, message: String }

POST /api/auth/login  
Body: { email: String, password: String }
Response: { 
  success: Boolean, 
  user?: { id, name, email }, 
  token?: String, 
  error?: String 
}

POST /api/auth/forgot-password
Body: { email: String }
Response: { success: Boolean, message: String }

POST /api/auth/reset-password
Body: { token: String, newPassword: String }
Response: { success: Boolean, message: String }
```

### 3.2 User Profile Endpoints
```javascript
GET /api/user/profile
Headers: { Authorization: "Bearer <token>" }
Response: { user: { id, name, email, createdAt } }

PUT /api/user/profile
Headers: { Authorization: "Bearer <token>" }
Body: { name?: String }
Response: { success: Boolean, user?: Object }
```

### 3.3 Session Endpoints
```javascript
POST /api/sessions
Headers: { Authorization: "Bearer <token>" }
Body: { sessionData: SessionRecord }
Response: { success: Boolean, sessionId: String }

GET /api/sessions
Headers: { Authorization: "Bearer <token>" }
Query: { page?: Number, limit?: Number }
Response: { 
  sessions: Array<SessionRecord>, 
  total: Number, 
  page: Number 
}

GET /api/sessions/:sessionId
Headers: { Authorization: "Bearer <token>" }
Response: { session: SessionRecord }

DELETE /api/sessions/:sessionId
Headers: { Authorization: "Bearer <token>" }
Response: { success: Boolean }
```

### 3.4 Health Check
```javascript
GET /api/health
Response: { 
  status: 'ok'|'error', 
  timestamp: String,
  database: 'connected'|'error'
}
```

## Environment Configuration

### 4.1 Required Environment Variables
```bash
# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mediapose?retryWrites=true&w=majority

# Authentication
JWT_SECRET=your-jwt-secret-at-least-32-characters-long
BCRYPT_ROUNDS=10

# Email Service (using Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
FROM_EMAIL=noreply@yourapp.com

# Application
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourapp.com

# Email Templates
EMAIL_VERIFICATION_TEMPLATE=basic-html-template
PASSWORD_RESET_TEMPLATE=basic-html-template
```

## Email Service Setup

### 5.1 Gmail SMTP Configuration
```javascript
// Using nodemailer with Gmail
const transporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS // Gmail App Password required
  }
});

// Email templates (simple HTML)
const verificationEmailTemplate = (name, token) => `
  <h2>Welcome ${name}!</h2>
  <p>Please verify your email by clicking the link below:</p>
  <a href="${process.env.FRONTEND_URL}/verify-email/${token}">Verify Email</a>
  <p>This link expires in 24 hours.</p>
`;

const resetPasswordTemplate = (name, token) => `
  <h2>Password Reset Request</h2>
  <p>Hi ${name}, click the link below to reset your password:</p>
  <a href="${process.env.FRONTEND_URL}/reset-password/${token}">Reset Password</a>
  <p>This link expires in 1 hour.</p>
`;
```

## MongoDB Atlas Setup Requirements

### 6.1 Free Tier Limits & Optimization
```javascript
// MongoDB Atlas Free Tier (M0)
- Storage: 512 MB
- RAM: Shared
- vCPUs: Shared
- Connections: 500 max

// Storage Estimation for 50 users:
User document: ~200 bytes × 50 = 10 KB
Session document: ~2 KB average × 10 sessions/user × 50 users = 1 MB
Total estimated: ~1.1 MB (well within 512 MB limit)

// Connection management
- Use connection pooling
- Close connections properly
- Maximum 10 concurrent connections for safety
```

### 6.2 Database Optimization
```javascript
// Keep documents lean
- No file storage in database
- Compress large objects
- Use embedded documents for related data
- Implement data cleanup for old sessions (optional)

// Indexing strategy
- Only essential indexes to save space
- Compound indexes for common queries
- Monitor index usage
```

## Deployment Architecture (Simplified)

### 7.1 Recommended Stack
```yaml
# Simple deployment options:
1. Vercel/Netlify (Frontend) + Railway/Render (Backend)
2. Single VPS with PM2
3. Heroku (if budget allows)

# Docker setup (optional)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### 7.2 Basic Security
```javascript
// Security middleware
- helmet() for basic security headers
- cors() with specific origins
- express-rate-limit (100 requests/15min per IP)
- express-validator for input validation
- bcrypt for password hashing
- JWT for stateless authentication
```

## Implementation Priority

### Phase 1: Basic Auth (Week 1)
1. MongoDB connection setup
2. User registration with email verification
3. Login/logout functionality
4. Basic error handling

### Phase 2: Session Management (Week 2)
1. Session CRUD operations
2. User profile management
3. Basic session history

### Phase 3: Polish & Deploy (Week 3)
1. Email templates
2. Security hardening
3. Deployment setup
4. Basic testing

## Cost Estimation

### Monthly Costs (for 50 users)
```
MongoDB Atlas M0: $0 (free tier)
Email Service (Gmail): $0 (personal Gmail account)
Backend Hosting: $5-20 (Railway/Render/Vercel)
Domain (optional): $10-15/year

Total Monthly: $5-20
```

## Data Storage Calculation

### Storage Requirements
```javascript
// Per user storage:
User profile: ~0.2 KB
Sessions (10/month avg): ~2 KB each = 20 KB
Total per user: ~20.2 KB

// 50 users total: ~1 MB
// Well within MongoDB Atlas free 512 MB limit
// Can support up to 25,000 users theoretically
```

## Additional Requirements for Your Setup

### 8.1 Email Verification Requirements
```bash
# You'll need:
1. Gmail account with App Password enabled
2. Two-factor authentication on Gmail
3. App Password generation in Google Account settings
4. Domain name (optional, can use localhost for development)
```

### 8.2 MongoDB Atlas Setup Steps
```bash
1. Create MongoDB Atlas account (free)
2. Create new cluster (M0 free tier)
3. Set up database user and password
4. Whitelist IP addresses (0.0.0.0/0 for development)
5. Get connection string
6. Create database named "mediapose"
```

This simplified approach will handle your 30-50 users easily, provide email verification, and store only the essential data you need while staying within free/low-cost tiers.