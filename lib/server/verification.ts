import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

const EMAIL_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET; // Reuse refresh secret for email tokens
const EMAIL_TOKEN_TTL = process.env.EMAIL_TOKEN_TTL || '24h';

if (!EMAIL_TOKEN_SECRET) {
  throw new Error('JWT_REFRESH_SECRET is required for email token signing');
}

interface EmailTokenPayload {
  sub: string; // userId
  type: 'email_verification';
  jti: string; // unique token ID
  iat: number;
  exp: number;
}

export function createEmailToken(userId: ObjectId): { token: string; expiresAt: Date } {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseTTL(EMAIL_TOKEN_TTL);
  const jti = crypto.randomBytes(16).toString('hex'); // Unique token ID
  
  const payload: EmailTokenPayload = {
    sub: userId.toString(),
    type: 'email_verification',
    jti,
    iat: now,
    exp,
  };
  
  const token = jwt.sign(payload, EMAIL_TOKEN_SECRET);
  const expiresAt = new Date(exp * 1000);
  
  return { token, expiresAt };
}

export function verifyEmailToken(token: string): { userId: ObjectId; jti: string } {
  try {
    const decoded = jwt.verify(token, EMAIL_TOKEN_SECRET) as EmailTokenPayload;
    
    if (decoded.type !== 'email_verification') {
      throw new Error('INVALID_TOKEN_TYPE');
    }
    
    return {
      userId: new ObjectId(decoded.sub),
      jti: decoded.jti,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('EMAIL_TOKEN_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('INVALID_EMAIL_TOKEN');
    }
    throw new Error('EMAIL_TOKEN_VERIFICATION_FAILED');
  }
}

// For enhanced security, we can optionally store email token hashes
// and invalidate them after use (single-use tokens)
export function hashEmailToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Utility function to parse TTL strings like '24h', '15m'
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