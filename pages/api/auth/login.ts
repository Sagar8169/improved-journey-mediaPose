import { NextApiRequest, NextApiResponse } from 'next';
import { getCollections } from '@/lib/server/db';
import { verifyPassword, signAccessToken, issueRefreshToken } from '@/lib/server/auth';
import { LoginSchema, LoginResponse, ApiResponse, validateBody, LoginRequest } from '@/lib/server/validation';
import { withCorsAndError } from '@/lib/server/middleware';
import { withAuthRateLimit } from '@/lib/server/rateLimit';
import { withMethods } from '@/lib/server/middleware';
import { sendSecurityAlert } from '@/lib/server/email';

async function loginHandler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<LoginResponse>>
) {
  // Validate request body
  const validatedBody = validateBody(LoginSchema, req.body);
  if ('success' in validatedBody && !validatedBody.success) {
    return res.status(400).json(validatedBody);
  }

  const bodyData = validatedBody as LoginRequest;
  const { email, password } = bodyData;

  try {
    const { users } = await getCollections();

    // Find user by email
    const user = await users.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }

    // Generate access token
    const accessToken = signAccessToken({
      sub: user._id!.toString(),
      email: user.email,
      roles: user.roles,
    });

    // Generate refresh token and set cookie
    const deviceInfo = {
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    };
    
    const refreshTokenInfo = await issueRefreshToken(user._id!, deviceInfo);
    
    // Set refresh token cookie
    res.setHeader('Set-Cookie', refreshTokenInfo.cookie);

    // Send security alert (async, don't wait)
    sendSecurityAlert(user.email, 'login').catch(err => 
      console.error('Failed to send security alert:', err)
    );

    console.log(`User logged in: ${user.email}`);

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
    console.error('Login error:', error);
    throw error; // Will be caught by withError middleware
  }
}

export default withCorsAndError(
  withMethods(['POST'])(
    withAuthRateLimit(loginHandler)
  )
);