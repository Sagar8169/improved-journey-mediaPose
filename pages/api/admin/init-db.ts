import { NextApiRequest, NextApiResponse } from 'next';
import { ensureIndexes } from '@/lib/server/db';
import { ApiResponse } from '@/lib/server/validation';
import { withAuthAndCors } from '@/lib/server/middleware';

async function initDbHandler(
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

  // Only admin can initialize database
  if (!req.user.roles.includes('admin')) {
    return res.status(403).json({
      success: false,
      error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required' }
    });
  }

  try {
    await ensureIndexes();
    
    console.log(`Database indexes initialized by admin: ${req.user.email}`);

    res.status(200).json({
      success: true,
      data: { message: 'Database indexes initialized successfully' }
    });

  } catch (error) {
    console.error('Database initialization error:', error);
    throw error; // Will be caught by withError middleware
  }
}

export default withAuthAndCors(initDbHandler, 'admin');