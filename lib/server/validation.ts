import { z } from 'zod';

// Auth schemas
export const SignupSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1, 'Display name is required').max(100, 'Display name too long'),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const ResendVerificationSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
});

// Session schemas
export const SessionCreateSchema = z.object({
  drillType: z.string().optional(),
  deviceInfo: z.any().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  startAt: z.string().datetime().optional(),
});

export const FinishSessionSchema = z.object({
  finalizedReport: z.record(z.string(), z.any()).optional(),
  endAt: z.string().datetime(),
});

// Account management schemas
export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(100, 'Display name too long').optional(),
  // Add other profile fields as needed
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

// Pagination and filtering schemas
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  hideLowQuality: z.coerce.boolean().optional(),
});

// Email verification schema
export const EmailVerificationSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

// Common response types
export type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// Inferred types from schemas
export type SignupRequest = z.infer<typeof SignupSchema>;
export type LoginRequest = z.infer<typeof LoginSchema>;
export type SessionCreateRequest = z.infer<typeof SessionCreateSchema>;
export type FinishSessionRequest = z.infer<typeof FinishSessionSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordSchema>;
export type PaginationQuery = z.infer<typeof PaginationSchema>;

// Response types
export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    emailVerified: boolean;
    roles: string[];
  };
}

export interface SessionCreateResponse {
  sessionId: string;
}

export interface SessionSummary {
  id: string;
  startAt: string;
  endAt?: string;
  durationMs?: number;
  qualityFlag?: string;
  summary?: Record<string, any>;
  // derived convenience fields
  reps?: number;
  detectionRate?: number;
}

export interface SessionListResponse {
  sessions: SessionSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Validation helper function
export function createValidationError(message: string, code: string = 'VALIDATION_ERROR') {
  return {
    success: false as const,
    error: { code, message }
  };
}

// Helper to validate request body with proper error handling
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): T | ApiResponse<never> {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return createValidationError(message);
    }
    return createValidationError('Invalid request format');
  }
}

// Helper to validate query parameters
export function validateQuery<T>(schema: z.ZodSchema<T>, query: unknown): T | ApiResponse<never> {
  try {
    return schema.parse(query);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return createValidationError(message, 'INVALID_QUERY');
    }
    return createValidationError('Invalid query parameters', 'INVALID_QUERY');
  }
}