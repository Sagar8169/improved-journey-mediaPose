# Environment Configuration

This document outlines the required environment variables for deploying the BJJ Pose Tracking application.

## Required Environment Variables

### Database Configuration

- `MONGODB_URI`: MongoDB connection string (Atlas or self-hosted)
  - Example: `mongodb+srv://username:password@cluster.mongodb.net/bjj_training?retryWrites=true&w=majority`
- `MONGODB_DB_NAME`: Database name (default: `rollmetric`)

### Authentication & JWT

- `JWT_SECRET`: Secret key for signing access tokens (must be strong, 256+ bits)
- `JWT_REFRESH_SECRET`: Secret key for refresh tokens (different from JWT_SECRET)
- `ACCESS_TOKEN_TTL`: Access token expiration (default: `15m`)
- `REFRESH_TOKEN_TTL`: Refresh token expiration (default: `30d`)
- `EMAIL_TOKEN_TTL`: Email verification token expiration (default: `24h`)

### Cookie Configuration

- `COOKIE_NAME_REFRESH`: Name for refresh token cookie (default: `rm_refresh`)
- `SECURE_COOKIES`: Whether to use secure cookies in production (default: `true`)

### Email Service (Resend)

- `RESEND_API_KEY`: Your Resend API key (format: `re_XXXXXXXXXXXXXXXXXXXXXXXX`)
- `EMAIL_FROM`: Email address for sending system emails (must be verified in Resend)

### Application URLs

- `NEXT_PUBLIC_BASE_URL`: Public URL of your application
- `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins

### Environment

- `NODE_ENV`: Environment type (`production`, `development`, `test`)

## Setup Instructions

### 1. MongoDB Atlas Setup

1. Create a MongoDB Atlas account at https://cloud.mongodb.com
2. Create a new cluster
3. Create a database user with read/write permissions
4. Get your connection string from Atlas dashboard
5. Replace username/password in the connection string

### 2. Resend Email Service Setup

1. Create account at https://resend.com
2. Generate API key in dashboard
3. Verify your sending domain
4. Set `EMAIL_FROM` to a verified email address

### 3. JWT Secrets Generation

Generate strong secrets for JWT tokens:

```bash
# Generate JWT secrets (Node.js)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Environment File Setup

1. Copy `.env.example` to `.env.local` (for local development) or configure in Netlify dashboard
2. Fill in all required values
3. Never commit real secrets to version control

## Netlify Deployment Configuration

In your Netlify dashboard:

1. Go to Site Settings → Environment Variables
2. Add all required environment variables listed above
3. Make sure `NODE_ENV` is set to `production`
4. Ensure `NEXT_PUBLIC_BASE_URL` matches your site URL

### Netlify-Specific Variables

These are automatically set by Netlify:
- `NETLIFY=true`
- `URL`: Your site's URL
- `DEPLOY_URL`: Deploy preview URL

## Security Best Practices

1. **Use strong secrets**: Generate cryptographically secure random strings for JWT secrets
2. **Rotate secrets**: Regularly rotate JWT secrets (requires user re-authentication)
3. **Secure cookies**: Always use `SECURE_COOKIES=true` in production
4. **CORS configuration**: Only include trusted domains in `CORS_ALLOWED_ORIGINS`
5. **Environment isolation**: Use different database/keys for staging and production

## Validation

After deployment, verify your configuration:

1. Check health endpoint: `GET /api/health`
2. Test database connectivity: `GET /api/admin/init-db` (admin only)
3. Test authentication flow: Try signup/login from frontend
4. Check email delivery: Test signup with real email address

## Troubleshooting

### Common Issues

- **Database connection fails**: Check MongoDB Atlas IP whitelist and connection string format
- **Email not sending**: Verify Resend API key and domain verification
- **JWT errors**: Ensure secrets are properly set and match between all environments
- **CORS errors**: Add your domain to `CORS_ALLOWED_ORIGINS`

### Debug Mode

For debugging, temporarily set these in development:
- `DEBUG=true`: Enable additional logging
- `NODE_ENV=development`: Enable development features

Never use debug settings in production.