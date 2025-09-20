import { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { getCollections } from '@/lib/server/db';
import { rotateRefreshToken, signAccessToken, clearRefreshCookie } from '@/lib/server/auth';
import { ApiResponse } from '@/lib/server/validation';
import { withCorsAndError } from '@/lib/server/middleware';
import { withMethods } from '@/lib/server/middleware';

interface RefreshResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    emailVerified: boolean;
    roles: string[];
  };
}

async function refreshHandler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<RefreshResponse>>
) {
  const cookieName = process.env.COOKIE_NAME_REFRESH || 'rm_refresh';
  const refreshToken = req.cookies[cookieName];

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      error: { code: 'MISSING_REFRESH_TOKEN', message: 'Refresh token not found' }
    });
  }

  try {
    // Get user ID from Authorization header if present (optional, for better error handling)
    let userId: ObjectId | null = null;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(authHeader.substring(7)) as any;
        if (decoded?.sub) {
          userId = new ObjectId(decoded.sub);
        }
      } catch {
        // Ignore decode errors - we'll find user via refresh token lookup
      }
    }

    // If no user ID from token, we need to find the user by refresh token
    if (!userId) {
      const { users } = await getCollections();
      const crypto = require('crypto');
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('base64url');
      
      const userWithToken = await users.findOne({
        'refreshTokens.tokenHash': tokenHash,
        'refreshTokens.expiresAt': { $gt: new Date() }
      });
      
      if (!userWithToken) {
        // Clear the invalid cookie
        res.setHeader('Set-Cookie', clearRefreshCookie());
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' }
        });
      }
      
      userId = userWithToken._id!;
    }

    // Rotate the refresh token
    const newTokenInfo = await rotateRefreshToken(refreshToken, userId);
    
    if (!newTokenInfo) {
      // Clear the invalid cookie
      res.setHeader('Set-Cookie', clearRefreshCookie());
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_ROTATION_FAILED', message: 'Failed to rotate refresh token' }
      });
    }

    // Get updated user info
    const { users } = await getCollections();
    const user = await users.findOne({ _id: userId });
    
    if (!user) {
      res.setHeader('Set-Cookie', clearRefreshCookie());
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    // Generate new access token
    const accessToken = signAccessToken({
      sub: user._id!.toString(),
      email: user.email,
      roles: user.roles,
    });

    // Set new refresh token cookie
    res.setHeader('Set-Cookie', newTokenInfo.cookie);

    console.log(`Token refreshed for user: ${user.email}`);

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user._id!.toString(),
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified,
          roles: user.roles,
        }
      }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    
    // Clear cookie on any refresh error
    res.setHeader('Set-Cookie', clearRefreshCookie());
    
    throw error; // Will be caught by withError middleware
  }
}

export default withCorsAndError(
  withMethods(['POST'])(refreshHandler)
);