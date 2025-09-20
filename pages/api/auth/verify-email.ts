import { NextApiRequest, NextApiResponse } from 'next';
import { getCollections } from '@/lib/server/db';
import { verifyEmailToken } from '@/lib/server/verification';
import { ApiResponse } from '@/lib/server/validation';
import { withCorsAndError } from '@/lib/server/middleware';
import { withMethods } from '@/lib/server/middleware';

async function verifyEmailHandler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ message: string }>>
) {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_TOKEN', message: 'Verification token is required' }
    });
  }

  try {
    // Verify the token and extract user ID
    const { userId } = verifyEmailToken(token);

    const { users } = await getCollections();
    
    // Find the user
    const user = await users.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        data: { message: 'Email already verified. You can now use all features.' }
      });
    }

    // Update user to verified
    await users.updateOne(
      { _id: userId },
      { 
        $set: { 
          emailVerified: true,
          updatedAt: new Date()
        } 
      }
    );

    console.log(`Email verified for user: ${user.email}`);

    res.status(200).json({
      success: true,
      data: { message: 'Email verified successfully. You can now use all features.' }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    throw error; // Will be caught by withError middleware
  }
}

export default withCorsAndError(
  withMethods(['GET'])(verifyEmailHandler)
);