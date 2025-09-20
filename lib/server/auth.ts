import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { getCollections } from './db';
import crypto from 'crypto';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  iat: number;
  exp: number;
}

export interface RefreshTokenInfo {
  token: string;
  hash: string;
  cookie: string;
  expiresAt: Date;
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET environment variables are required');
}

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || '30d';
const COOKIE_NAME = process.env.COOKIE_NAME_REFRESH || 'rm_refresh';
const SECURE_COOKIES = process.env.SECURE_COOKIES !== 'false';

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT Access Token functions
export function signAccessToken(payload: { sub: string; email: string; roles: string[] }): string {
  const now = Math.floor(Date.now() / 1000);
  
  return jwt.sign({
    ...payload,
    iat: now,
    exp: now + parseTTL(ACCESS_TOKEN_TTL),
  }, JWT_SECRET);
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('ACCESS_TOKEN_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('INVALID_ACCESS_TOKEN');
    }
    throw new Error('TOKEN_VERIFICATION_FAILED');
  }
}

// Refresh Token functions
export async function issueRefreshToken(
  userId: ObjectId, 
  deviceInfo?: any
): Promise<RefreshTokenInfo> {
  // Generate cryptographically strong random token
  const token = crypto.randomBytes(32).toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('base64url');
  
  const expiresAt = new Date(Date.now() + parseTTL(REFRESH_TOKEN_TTL) * 1000);
  
  // Store token hash in user document
  const { users } = await getCollections();
  await users.updateOne(
    { _id: userId },
    {
      $push: {
        refreshTokens: {
          tokenHash: hash,
          createdAt: new Date(),
          expiresAt,
          deviceInfo: deviceInfo || null,
        }
      }
    }
  );

  // Create cookie string
  const cookie = `${COOKIE_NAME}=${token}; HttpOnly; ${SECURE_COOKIES ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=${parseTTL(REFRESH_TOKEN_TTL)}`;

  return { token, hash, cookie, expiresAt };
}

export async function rotateRefreshToken(
  oldToken: string, 
  userId: ObjectId
): Promise<{ token: string; cookie: string } | null> {
  const oldHash = crypto.createHash('sha256').update(oldToken).digest('base64url');
  
  const { users } = await getCollections();
  const user = await users.findOne({ _id: userId });
  
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  // Find the matching refresh token
  const tokenIndex = user.refreshTokens.findIndex(
    rt => rt.tokenHash === oldHash && rt.expiresAt > new Date()
  );

  if (tokenIndex === -1) {
    // Token not found or expired - check if it was previously used (reuse detection)
    const usedToken = user.refreshTokens.find(rt => rt.tokenHash === oldHash);
    if (usedToken) {
      // Possible token reuse attack - revoke all refresh tokens
      await users.updateOne(
        { _id: userId },
        { $set: { refreshTokens: [] } }
      );
      throw new Error('TOKEN_REUSE_DETECTED');
    }
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  // Remove the old token
  await users.updateOne(
    { _id: userId },
    { $pull: { refreshTokens: { tokenHash: oldHash } } }
  );

  // Issue new token
  const newTokenInfo = await issueRefreshToken(userId);
  
  return {
    token: newTokenInfo.token,
    cookie: newTokenInfo.cookie
  };
}

export async function revokeRefreshToken(token: string, userId: ObjectId): Promise<void> {
  const hash = crypto.createHash('sha256').update(token).digest('base64url');
  
  const { users } = await getCollections();
  await users.updateOne(
    { _id: userId },
    { $pull: { refreshTokens: { tokenHash: hash } } }
  );
}

export async function revokeAllRefreshTokens(userId: ObjectId): Promise<void> {
  const { users } = await getCollections();
  await users.updateOne(
    { _id: userId },
    { $set: { refreshTokens: [] } }
  );
}

export function clearRefreshCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; ${SECURE_COOKIES ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=0`;
}

// Utility function to parse TTL strings like '15m', '30d'
function parseTTL(ttl: string): number {
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid TTL format: ${ttl}`);
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default: throw new Error(`Invalid TTL unit: ${unit}`);
  }
}

// Clean up expired refresh tokens (call periodically)
export async function cleanupExpiredTokens(userId?: ObjectId): Promise<void> {
  const { users } = await getCollections();
  const filter = userId ? { _id: userId } : {};
  
  await users.updateMany(
    filter,
    {
      $pull: {
        refreshTokens: {
          expiresAt: { $lt: new Date() }
        }
      }
    }
  );
}