import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import * as dotenv from 'dotenv';
import { log } from '../server/utils/logger'; // Adjust path as needed

dotenv.config(); // Load .env file if present (useful for local dev)

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  log("FATAL: DATABASE_URL environment variable is not set.", "db-init");
  throw new Error("DATABASE_URL must be set.");
}

const isProduction = process.env.NODE_ENV === 'production';

log(`Initializing DB Pool. Production mode: ${isProduction}`, "db-init");
log(`DB URL Host: ${databaseUrl.split('@')[1]?.split(':')[0] || 'Not Parsed'}`, "db-init"); // Log host without credentials

// Configure connection pool
const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: isProduction ? 10000 : 5000, // Longer timeout for prod?
  max: isProduction ? 20 : 10, // Adjust pool size based on environment/load
  idleTimeoutMillis: 30000,
  // Enable SSL in production, disable strict certificate verification
  // as RDS typically handles this. For other providers, you might need `ca` certificate.
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Pool error handling
pool.on('error', (err, client) => {
    log(`Unexpected error on idle DB client: ${err.message}`, 'db-pool-error');
    console.error('DB Pool Error Stack:', err.stack);
    // Consider adding logic to gracefully handle persistent pool errors
});

pool.on('connect', (client) => {
    log('DB client connected to pool.', 'db-pool-debug'); // Debug level log
});

pool.on('acquire', (client) => {
     log('DB client acquired from pool.', 'db-pool-debug'); // Debug level log
});

pool.on('remove', (client) => {
     log('DB client removed from pool.', 'db-pool-debug'); // Debug level log
});


// Initialize Drizzle ORM
// Enable Drizzle logger only in non-production environments for debugging SQL
export const db = drizzle(pool, { schema, logger: !isProduction });

log("Drizzle ORM initialized.", "db-init");

// Export pool for potential direct use (e.g., migrations)
export { pool };
