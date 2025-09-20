import { NextApiRequest, NextApiResponse } from 'next';
import { pingDatabase } from '@/lib/server/db';

interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  memory?: {
    used: number;
    total: number;
    percentage: number;
  };
  database?: {
    connected: boolean;
    latencyMs: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthCheckResponse>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    });
    return;
  }

  try {
    // Basic health check information
    const healthData: HealthCheckResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    };

    // Add memory usage information if available
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      healthData.memory = {
        used: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100, // MB
        total: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100, // MB
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      };
    }

    // Check database connectivity
    try {
      const dbStatus = await pingDatabase();
      healthData.database = {
        connected: dbStatus.connected,
        latencyMs: dbStatus.latencyMs,
      };

      // Set overall status based on critical services
      if (!dbStatus.connected) {
        healthData.status = 'error';
      }
    } catch (dbError) {
      console.error('Database health check failed:', dbError);
      healthData.database = {
        connected: false,
        latencyMs: -1,
      };
      healthData.status = 'error';
    }

    // Set appropriate headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Type', 'application/json');

    // Return appropriate status code
    const statusCode = healthData.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(healthData);
  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    });
  }
}