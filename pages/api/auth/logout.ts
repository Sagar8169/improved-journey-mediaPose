import { NextApiRequest, NextApiResponse } from 'next';
import { revokeRefreshToken, clearRefreshCookie } from '@/lib/server/auth';
import { ApiResponse } from '@/lib/server/validation';
import { withAuthAndCors } from '@/lib/server/middleware';
import { withMethods } from '@/lib/server/middleware';
import { ObjectId } from 'mongodb';

async function logoutHandler(
  req: any, // AuthenticatedRequest
  res: NextApiResponse<ApiResponse<{ message: string }>>
) {
  // Only allow POST method
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }
    });
  }
  const cookieName = process.env.COOKIE_NAME_REFRESH || 'rm_refresh';
  const refreshToken = req.cookies[cookieName];
  
  try {
    // Revoke refresh token if present
    if (refreshToken && req.user?.id) {
      await revokeRefreshToken(refreshToken, new ObjectId(req.user.id));
      console.log(`User logged out: ${req.user.email}`);
    }

    // Clear the refresh token cookie
    res.setHeader('Set-Cookie', clearRefreshCookie());

    res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully' }
    });

  } catch (error) {
    console.error('Logout error:', error);
    
    // Always clear the cookie even if revocation fails
    res.setHeader('Set-Cookie', clearRefreshCookie());
    
    // Still return success to client - logout should always appear to work
    res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully' }
    });
  }
}

export default withAuthAndCors(logoutHandler);