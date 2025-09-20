import { ensureIndexes } from '@/lib/server/db';

/**
 * Database initialization script
 * Run this once during deployment to ensure all required indexes exist
 */
async function initializeDatabase() {
  try {
    console.log('Initializing database indexes...');
    await ensureIndexes();
    console.log('Database indexes initialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

export { initializeDatabase };