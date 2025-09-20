import { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { getCollections } from '@/lib/server/db';
import { SessionCreateSchema, ApiResponse, SessionCreateResponse, SessionCreateRequest, validateBody } from '@/lib/server/validation';
import { withAuthVerifiedAndCors } from '@/lib/server/middleware';
import { withMethods } from '@/lib/server/middleware';

async function startSessionHandler(
  req: any, // AuthenticatedRequest
  res: NextApiResponse<ApiResponse<SessionCreateResponse>>
) {
  // Only allow POST method
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }
    });
  }

  // Validate request body
  const validatedBody = validateBody(SessionCreateSchema, req.body);
  if ('success' in validatedBody && !validatedBody.success) {
    return res.status(400).json(validatedBody);
  }

  const bodyData = validatedBody as SessionCreateRequest;
  const { drillType, deviceInfo, metadata, startAt } = bodyData;

  try {
    const { sessions } = await getCollections();
    
    const sessionId = new ObjectId();
    const now = new Date();
    const sessionStart = startAt ? new Date(startAt) : now;

    // Create session stub
    await sessions.insertOne({
      _id: sessionId,
      userId: new ObjectId(req.user.id),
      startAt: sessionStart,
      rawReport: {}, // Will be filled when session is finished
      qualityFlag: undefined,
      deviceInfo: deviceInfo || null,
      drillType: drillType || null,
      mediaType: undefined,
      createdAt: now,
      updatedAt: now,
      // Add metadata to rawReport if provided
      ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {})
    });

    console.log(`Session started for user ${req.user.email}: ${sessionId}`);

    res.status(201).json({
      success: true,
      data: { sessionId: sessionId.toString() }
    });

  } catch (error) {
    console.error('Start session error:', error);
    throw error; // Will be caught by withError middleware
  }
}

export default withAuthVerifiedAndCors(startSessionHandler);