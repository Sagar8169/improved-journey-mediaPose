import { MongoClient, Db, Collection } from 'mongodb';

interface User {
  _id?: import('mongodb').ObjectId;
  email: string;
  passwordHash: string;
  displayName: string;
  emailVerified: boolean;
  roles: string[];
  refreshTokens: Array<{
    tokenHash: string;
    createdAt: Date;
    expiresAt: Date;
    deviceInfo?: any;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface Session {
  _id?: import('mongodb').ObjectId;
  userId: import('mongodb').ObjectId;
  startAt: Date;
  endAt?: Date;
  durationMs?: number;
  summary?: Record<string, any>;
  // v1 legacy payload, optional for backward compatibility (no longer written for v2)
  rawReport?: Record<string, any>;
  // v2 aggregated report (JSON-storable)
  report?: import('../metrics/types').SessionReport;
  qualityFlag?: 'good' | 'low' | 'discard';
  deviceInfo?: any;
  mediaType?: string;
  drillType?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AuditLog {
  _id?: import('mongodb').ObjectId;
  userId?: import('mongodb').ObjectId;
  action: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, any>;
  createdAt: Date;
}

// Global MongoDB client cache for serverless functions
declare global {
  var __MONGO__: MongoClient | undefined;
}

let client: MongoClient | null = globalThis.__MONGO__ || null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      retryWrites: true,
    });

    // Cache the client globally to survive warm serverless invocations
    globalThis.__MONGO__ = client;
  }

  // Connect if not already connected
  try {
    await client.db().admin().ping();
  } catch (error) {
    // If ping fails, try to connect
    await client.connect();
  }

  const dbName = process.env.MONGODB_DB_NAME || 'rollmetric';
  const db = client.db(dbName);

  return { client, db };
}

export async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

export async function getCollections() {
  const db = await getDb();
  
  return {
    users: db.collection<User>('users'),
    sessions: db.collection<Session>('sessions'),
    auditLogs: db.collection<AuditLog>('auditLogs'),
  };
}

// Health check for database connection
export async function pingDatabase(): Promise<{ connected: boolean; latencyMs: number }> {
  try {
    const start = Date.now();
    const db = await getDb();
    await db.admin().ping();
    const latencyMs = Date.now() - start;
    return { connected: true, latencyMs };
  } catch (error) {
    console.error('Database ping failed:', error);
    return { connected: false, latencyMs: -1 };
  }
}

// Initialize database indexes (call once during deployment)
export async function ensureIndexes(): Promise<void> {
  const { users, sessions, auditLogs } = await getCollections();

  // Users collection indexes
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ 'refreshTokens.expiresAt': 1 });

  // Sessions collection indexes
  await sessions.createIndex({ userId: 1, createdAt: -1 });
  // TTL index for 90-day retention
  await sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

  // Audit logs collection indexes (optional)
  await auditLogs.createIndex({ userId: 1, createdAt: -1 });
  await auditLogs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

  console.log('Database indexes ensured');
}

export type { User, Session, AuditLog };