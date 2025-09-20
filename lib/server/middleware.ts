import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { verifyAccessToken, JwtPayload } from './auth';
import { getCollections } from './db';
import { ObjectId } from 'mongodb';
import { ApiResponse, createValidationError } from './validation';

// Extend NextApiRequest to include user info
export interface AuthenticatedRequest extends NextApiRequest {
  user: {
    id: string;
    email: string;
    roles: string[];
    emailVerified: boolean;
  };
}

type ApiHandler<T = any> = (
  req: NextApiRequest, 
  res: NextApiResponse<ApiResponse<T>>
) => Promise<void> | void;

type AuthenticatedHandler<T = any> = (
  req: AuthenticatedRequest, 
  res: NextApiResponse<ApiResponse<T>>
) => Promise<void> | void;

// CORS middleware
export function withCors<T>(handler: ApiHandler<T>) {
  return async (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => {
    const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const origin = req.headers.origin;

    // Set CORS headers
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (allowedOrigins.length === 0) {
      // Development fallback
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    return handler(req, res);
  };
}

// Error handling middleware
export function withError<T>(handler: ApiHandler<T>) {
  return async (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('API Error:', error);

      // Handle known error types
      if (error instanceof Error) {
        const message = error.message;
        
        if (message === 'ACCESS_TOKEN_EXPIRED' || message === 'INVALID_ACCESS_TOKEN') {
          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' }
          });
        }

        if (message === 'EMAIL_TOKEN_EXPIRED' || message === 'INVALID_EMAIL_TOKEN') {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_TOKEN', message: 'Invalid or expired verification token' }
          });
        }

        if (message === 'TOKEN_REUSE_DETECTED') {
          return res.status(401).json({
            success: false,
            error: { code: 'SECURITY_VIOLATION', message: 'Token reuse detected. Please log in again.' }
          });
        }

        if (message === 'EMAIL_SEND_FAILED') {
          return res.status(500).json({
            success: false,
            error: { code: 'EMAIL_ERROR', message: 'Failed to send email. Please try again.' }
          });
        }

        if (message.startsWith('RATE_LIMIT')) {
          return res.status(429).json({
            success: false,
            error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' }
          });
        }
      }

      // Generic server error
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
      });
    }
  };
}

// Authentication middleware
export function withAuth<T>(handler: AuthenticatedHandler<T>, requiredRole?: string) {
  return async (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'Authorization token required' }
      });
    }

    const token = authHeader.substring(7);

    try {
      const payload = verifyAccessToken(token);
      
      // Fetch user from database to get current info
      const { users } = await getCollections();
      const user = await users.findOne({ _id: new ObjectId(payload.sub) });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' }
        });
      }

      // Check required role
      if (requiredRole && !user.roles.includes(requiredRole)) {
        return res.status(403).json({
          success: false,
          error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Insufficient permissions' }
        });
      }

      // Attach user info to request
      (req as AuthenticatedRequest).user = {
        id: user._id!.toString(),
        email: user.email,
        roles: user.roles,
        emailVerified: user.emailVerified,
      };

      return handler(req as AuthenticatedRequest, res);
    } catch (error) {
      throw error; // Will be caught by withError
    }
  };
}

// Email verification middleware
export function withVerifiedUser<T>(handler: AuthenticatedHandler<T>) {
  return async (req: AuthenticatedRequest, res: NextApiResponse<ApiResponse<T>>) => {
    if (!req.user.emailVerified) {
      return res.status(403).json({
        success: false,
        error: { 
          code: 'EMAIL_NOT_VERIFIED', 
          message: 'Email verification required. Please check your inbox.' 
        }
      });
    }

    return handler(req, res);
  };
}

// Validation middleware
export function withValidation<TBody, TQuery = any>(
  handler: ApiHandler,
  options?: {
    body?: z.ZodSchema<TBody>;
    query?: z.ZodSchema<TQuery>;
  }
) {
  return async (req: NextApiRequest, res: NextApiResponse<ApiResponse<any>>) => {
    // Validate request body
    if (options?.body && req.method !== 'GET' && req.method !== 'DELETE') {
      try {
        req.body = options.body.parse(req.body);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const message = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
          return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message }
          });
        }
        throw error;
      }
    }

    // Validate query parameters
    if (options?.query) {
      try {
        const validatedQuery = options.query.parse(req.query);
        req.query = validatedQuery as any;
      } catch (error) {
        if (error instanceof z.ZodError) {
          const message = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_QUERY', message }
          });
        }
        throw error;
      }
    }

    return handler(req, res);
  };
}

// Method restriction middleware
export function withMethods(methods: string[]) {
  return function<T>(handler: ApiHandler<T>) {
    return async (req: NextApiRequest, res: NextApiResponse<ApiResponse<T>>) => {
      if (!methods.includes(req.method || '')) {
        res.setHeader('Allow', methods.join(', '));
        return res.status(405).json({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` }
        });
      }

      return handler(req, res);
    };
  };
}

// Combine middlewares helper
export function combineMiddleware<T>(...middlewares: Array<(handler: any) => any>) {
  return (handler: ApiHandler<T>) => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
}

// Common middleware combinations
export const withAuthAndCors = <T>(handler: AuthenticatedHandler<T>, requiredRole?: string) =>
  withCors(withError(withAuth(handler, requiredRole)));

export const withAuthVerifiedAndCors = <T>(handler: AuthenticatedHandler<T>) =>
  withCors(withError(withAuth(withVerifiedUser(handler))));

export const withCorsAndError = <T>(handler: ApiHandler<T>) =>
  withCors(withError(handler));