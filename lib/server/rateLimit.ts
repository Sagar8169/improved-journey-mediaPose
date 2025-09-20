import { NextApiRequest, NextApiResponse } from 'next';
import { ApiResponse } from './validation';

// In-memory rate limiting store (per serverless function instance)
interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstAttempt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxAttempts: number;   // Maximum attempts per window
  keyGenerator?: (req: NextApiRequest) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  message?: string;      // Custom error message
}

// Default configurations for different endpoint types
export const authRateLimit: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 5,            // 5 attempts per IP/email combo
  message: 'Too many authentication attempts. Please try again in 15 minutes.'
};

export const emailRateLimit: RateLimitConfig = {
  windowMs: 60 * 1000,      // 1 minute
  maxAttempts: 2,           // 2 emails per minute
  message: 'Too many email requests. Please wait before requesting another.'
};

export const generalRateLimit: RateLimitConfig = {
  windowMs: 60 * 1000,      // 1 minute
  maxAttempts: 60,          // 60 requests per minute
  message: 'Too many requests. Please slow down.'
};

// Default key generator: combines IP and email (if present in body)
function defaultKeyGenerator(req: NextApiRequest): string {
  const ip = getClientIP(req);
  const email = req.body?.email || '';
  return `${ip}:${email}`;
}

// Extract client IP from request
function getClientIP(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const realIP = req.headers['x-real-ip'] as string;
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  
  return req.socket.remoteAddress || 'unknown';
}

// Clean up expired entries (call periodically)
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Rate limiting middleware
export function withRateLimit<T>(
  config: RateLimitConfig,
  handler: (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => {
    const keyGen = config.keyGenerator || defaultKeyGenerator;
    const key = keyGen(req);
    const now = Date.now();
    
    // Clean up expired entries occasionally (1% chance)
    if (Math.random() < 0.01) {
      cleanupExpiredEntries();
    }

    let entry = rateLimitStore.get(key);
    
    if (!entry) {
      // First request from this key
      entry = {
        count: 1,
        resetTime: now + config.windowMs,
        firstAttempt: now
      };
      rateLimitStore.set(key, entry);
    } else if (now > entry.resetTime) {
      // Window has expired, reset
      entry.count = 1;
      entry.resetTime = now + config.windowMs;
      entry.firstAttempt = now;
    } else {
      // Within the window
      entry.count++;
    }

    // Check if limit exceeded
    if (entry.count > config.maxAttempts) {
      const resetIn = Math.ceil((entry.resetTime - now) / 1000);
      const retryAfter = Math.max(resetIn, 1);
      
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', config.maxAttempts.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', entry.resetTime.toString());
      
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: config.message || 'Too many requests. Please try again later.'
        }
      });
    }

    // Set rate limit headers
    const remaining = Math.max(0, config.maxAttempts - entry.count);
    res.setHeader('X-RateLimit-Limit', config.maxAttempts.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', entry.resetTime.toString());

    try {
      await handler(req, res);
      
      // If request was successful and we should skip counting successful requests
      if (config.skipSuccessfulRequests && res.statusCode < 400) {
        entry.count = Math.max(0, entry.count - 1);
      }
    } catch (error) {
      throw error;
    }
  };
}

// Specific rate limit middlewares
export function withAuthRateLimit<T>(
  handler: (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => Promise<void>
) {
  return withRateLimit(authRateLimit, handler);
}

export function withEmailRateLimit<T>(
  handler: (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => Promise<void>
) {
  return withRateLimit(emailRateLimit, handler);
}

// Get rate limit status for a key (useful for debugging)
export function getRateLimitStatus(req: NextApiRequest, config: RateLimitConfig) {
  const keyGen = config.keyGenerator || defaultKeyGenerator;
  const key = keyGen(req);
  const entry = rateLimitStore.get(key);
  const now = Date.now();
  
  if (!entry || now > entry.resetTime) {
    return {
      count: 0,
      remaining: config.maxAttempts,
      resetTime: now + config.windowMs,
      isLimited: false
    };
  }
  
  return {
    count: entry.count,
    remaining: Math.max(0, config.maxAttempts - entry.count),
    resetTime: entry.resetTime,
    isLimited: entry.count >= config.maxAttempts
  };
}

// Custom key generators for specific use cases
export const keyGenerators = {
  // IP only
  ip: (req: NextApiRequest) => getClientIP(req),
  
  // Email only (for email-based limits)
  email: (req: NextApiRequest) => req.body?.email || getClientIP(req),
  
  // User ID (for authenticated requests)
  userId: (req: NextApiRequest) => {
    const authReq = req as any;
    return authReq.user?.id || getClientIP(req);
  },
  
  // IP + User Agent (for more specific tracking)
  ipUserAgent: (req: NextApiRequest) => {
    const ip = getClientIP(req);
    const ua = req.headers['user-agent'] || 'unknown';
    return `${ip}:${ua}`;
  }
};

/* 
Redis Upgrade Path Documentation:

To upgrade from in-memory rate limiting to Redis (for distributed rate limiting):

1. Install Redis client:
   npm install ioredis

2. Replace the in-memory Map with Redis operations:
   - GET key for current count
   - INCR key for incrementing
   - EXPIRE key windowMs for TTL

3. Example Redis implementation:
   ```typescript
   import Redis from 'ioredis';
   const redis = new Redis(process.env.REDIS_URL);
   
   async function rateLimitCheck(key: string, config: RateLimitConfig) {
     const current = await redis.incr(key);
     if (current === 1) {
       await redis.expire(key, Math.ceil(config.windowMs / 1000));
     }
     return current;
   }
   ```

4. Benefits of Redis upgrade:
   - Distributed rate limiting across multiple serverless instances
   - Persistent rate limit counters
   - Better accuracy for high-traffic scenarios
   - Shared state across different deployment regions

5. When to upgrade:
   - Multiple serverless regions/instances
   - High traffic requiring precise rate limiting
   - Need for rate limiting across different services
   - Current in-memory approach shows inconsistent behavior
*/