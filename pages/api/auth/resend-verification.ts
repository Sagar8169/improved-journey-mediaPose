import { NextApiRequest, NextApiResponse } from 'next';
import { getCollections } from '@/lib/server/db';
import { createEmailToken } from '@/lib/server/verification';
import { sendVerificationEmail } from '@/lib/server/email';
import { ResendVerificationSchema, ApiResponse, validateBody } from '@/lib/server/validation';
import { withCorsAndError } from '@/lib/server/middleware';
import { withEmailRateLimit } from '@/lib/server/rateLimit';
import { withMethods } from '@/lib/server/middleware';

async function resendVerificationHandler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ message: string }>>
) {
  // Validate request body
  const validatedBody = validateBody(ResendVerificationSchema, req.body);
  if ('success' in validatedBody && !validatedBody.success) {
    return res.status(400).json(validatedBody);
  }

  const bodyData = validatedBody as { email: string };
  const { email } = bodyData;

  try {
    const { users } = await getCollections();

    // Find user by email
    const user = await users.findOne({ email });
    if (!user) {
      // Don't reveal whether email exists - return success anyway
      return res.status(200).json({
        success: true,
        data: { message: 'If an account with this email exists and is unverified, a verification email has been sent.' }
      });
    }

    // If already verified, don't send email but return success
    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        data: { message: 'This account is already verified.' }
      });
    }

    // Generate and send new verification email
    const { token } = createEmailToken(user._id!);
    await sendVerificationEmail(email, token);

    console.log(`Verification email resent to: ${email}`);

    res.status(200).json({
      success: true,
      data: { message: 'If an account with this email exists and is unverified, a verification email has been sent.' }
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    throw error; // Will be caught by withError middleware
  }
}

export default withCorsAndError(
  withMethods(['POST'])(
    withEmailRateLimit(resendVerificationHandler)
  )
);