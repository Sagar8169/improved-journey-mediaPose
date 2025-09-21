import { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { getCollections } from '@/lib/server/db';
import { PaginationSchema, PaginationQuery, ApiResponse, SessionListResponse, validateQuery } from '@/lib/server/validation';
import { withAuthVerifiedAndCors } from '@/lib/server/middleware';

async function sessionsListHandler(
  req: any, // AuthenticatedRequest
  res: NextApiResponse<ApiResponse<SessionListResponse>>
) {
  // Only allow GET method
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }
    });
  }

  // Validate query parameters
  const validatedQuery = validateQuery(PaginationSchema, req.query);
  if ('success' in validatedQuery && !validatedQuery.success) {
    return res.status(400).json(validatedQuery);
  }

  const queryData = validatedQuery as PaginationQuery;
  const { page, limit, hideLowQuality } = queryData;

  try {
    const { sessions } = await getCollections();
    
    // Build query filter
    const filter: any = { userId: new ObjectId(req.user.id) };
    
    if (hideLowQuality) {
      filter.qualityFlag = { $ne: 'low' };
    }

    // Count total documents
    const total = await sessions.countDocuments(filter);
    const pages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    // Fetch sessions with pagination
    const sessionDocs = await sessions
      .find(filter)
      .sort({ createdAt: -1 }) // Most recent first
      .skip(skip)
      .limit(limit)
      .toArray();

    // Transform sessions for response
    const sessionSummaries = sessionDocs.map(session => ({
      id: session._id.toString(),
      startAt: session.startAt.toISOString(),
      endAt: session.endAt?.toISOString(),
      durationMs: session.durationMs,
      qualityFlag: session.qualityFlag,
  summary: session.summary ?? session.report, // prefer server stored summary; fallback to report
      // convenience fields for UI parity with legacy store, if present in rawReport
      reps: (session.rawReport?.totalReps) ?? undefined,
      detectionRate: (session.rawReport?.detectionRate) ?? undefined,
    }));

    const response: SessionListResponse = {
      sessions: sessionSummaries,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    };

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Sessions list error:', error);
    throw error; // Will be caught by withError middleware
  }
}

export default withAuthVerifiedAndCors(sessionsListHandler);