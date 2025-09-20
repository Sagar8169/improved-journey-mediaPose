import { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { getCollections } from '@/lib/server/db';
import { FinishSessionSchema, FinishSessionRequest, ApiResponse, validateBody } from '@/lib/server/validation';
import { withAuthVerifiedAndCors } from '@/lib/server/middleware';
import { buildSessionReport } from '@/lib/metrics/report';

// Configure body size limit for this endpoint
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
};

async function finishSessionHandler(
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

  // Check Content-Length early to avoid parsing large bodies
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) { // 2MB
    return res.status(413).json({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large. Maximum size is 2MB.' }
    });
  }

  const { sessionId } = req.query;
  
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_SESSION_ID', message: 'Session ID is required' }
    });
  }

  // Validate ObjectId format
  if (!ObjectId.isValid(sessionId)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_SESSION_ID', message: 'Invalid session ID format' }
    });
  }

  // Validate request body
  const validatedBody = validateBody(FinishSessionSchema, req.body);
  if ('success' in validatedBody && !validatedBody.success) {
    return res.status(400).json(validatedBody);
  }

  const bodyData = validatedBody as FinishSessionRequest;
  const { finalizedReport, endAt } = bodyData;

  try {
    const { sessions } = await getCollections();
    
    const sessionObjectId = new ObjectId(sessionId);
    const endTime = new Date(endAt);

    // Find the session and verify ownership
    const session = await sessions.findOne({ 
      _id: sessionObjectId,
      userId: new ObjectId(req.user.id)
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or access denied' }
      });
    }

    // Check if session is already finished
    if (session.endAt) {
      return res.status(409).json({
        success: false,
        error: { code: 'SESSION_ALREADY_FINISHED', message: 'Session has already been finished' }
      });
    }

    // Calculate session duration
    const durationMs = endTime.getTime() - session.startAt.getTime();
    
    if (durationMs < 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_END_TIME', message: 'End time cannot be before start time' }
      });
    }

    // Build session report/summary using existing metrics library
    let summary: Record<string, any> = {};
    let qualityFlag: 'good' | 'low' | 'discard' = 'good';
    
    try {
      // Create a mock SessionRecord for buildSessionReport
      const mockSessionRecord = {
        ...finalizedReport,
        startTs: session.startAt.getTime(),
        endTs: endTime.getTime(),
        durationSec: durationMs / 1000,
      };
      
      const sessionReport = buildSessionReport(mockSessionRecord as any, []);
      summary = sessionReport;
      
      // Determine quality flag based on duration and detection rate
      if (durationMs < 10000) { // Less than 10 seconds
        qualityFlag = 'discard';
      } else if (durationMs < 30000 || (finalizedReport.detectionRate && finalizedReport.detectionRate < 0.4)) {
        qualityFlag = 'low';
      }
      
    } catch (reportError) {
      console.error('Error building session report:', reportError);
      // Continue with basic summary if report building fails
      summary = {
        duration: durationMs,
        error: 'Report processing failed'
      };
      qualityFlag = 'low';
    }

    // Update the session with final data
    await sessions.updateOne(
      { _id: sessionObjectId },
      {
        $set: {
          endAt: endTime,
          durationMs,
          summary,
          rawReport: finalizedReport,
          qualityFlag,
          updatedAt: new Date(),
        }
      }
    );

    console.log(`Session finished for user ${req.user.email}: ${sessionId} (${durationMs}ms, ${qualityFlag})`);

    res.status(200).json({
      success: true,
      data: { message: 'Session finished successfully' }
    });

  } catch (error) {
    console.error('Finish session error:', error);
    throw error; // Will be caught by withError middleware
  }
}

export default withAuthVerifiedAndCors(finishSessionHandler);