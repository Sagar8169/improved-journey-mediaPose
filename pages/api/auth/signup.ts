import { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { getCollections } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/auth';
import { createEmailToken } from '@/lib/server/verification';
import { sendVerificationEmail } from '@/lib/server/email';
import { SignupSchema, SignupRequest, ApiResponse, validateBody } from '@/lib/server/validation';
import { withCorsAndError } from '@/lib/server/middleware';
import { withAuthRateLimit } from '@/lib/server/rateLimit';
import { withMethods } from '@/lib/server/middleware';

async function signupHandler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ message: string }>>
) {
  // Validate request body
  const validatedBody = validateBody(SignupSchema, req.body);
  if ('success' in validatedBody && !validatedBody.success) {
    return res.status(400).json(validatedBody);
  }

  const bodyData = validatedBody as SignupRequest;
  const { email, password, displayName } = bodyData;

  try {
    const { users } = await getCollections();

    // Check if user already exists
    const existingUser = await users.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists' }
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user document
    const userId = new ObjectId();
    const now = new Date();
    
    await users.insertOne({
      _id: userId,
      email,
      passwordHash,
      displayName,
      emailVerified: false,
      roles: ['user'],
      refreshTokens: [],
      createdAt: now,
      updatedAt: now,
    });

    // Generate and send verification email
    const { token } = createEmailToken(userId);
    await sendVerificationEmail(email, token);

    console.log(`User created and verification email sent: ${email}`);

    res.status(201).json({
      success: true,
      data: { 
        message: 'Account created successfully. Please check your email to verify your account.' 
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    
    // Handle specific MongoDB errors
    if (error instanceof Error && error.message.includes('E11000')) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists' }
      });
    }
    
    throw error; // Will be caught by withError middleware
  }
}

export default withCorsAndError(
  withMethods(['POST'])(
    withAuthRateLimit(signupHandler)
  )
);