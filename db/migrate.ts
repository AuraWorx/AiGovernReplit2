// db/migrate.ts
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index'; // Import db and pool from your setup
import { log } from '../server/utils/logger'; // Adjust path if needed
import path from 'path';
import * as dotenv from 'dotenv';

// Load .env for local execution if needed
dotenv.config();

const migrationsFolder = path.resolve(__dirname, './migrations');

async function runMigrations() {
  log('Starting database migrations...', 'db-migrate');
  log(`Looking for migrations in: ${migrationsFolder}`, 'db-migrate');

  if (!process.env.DATABASE_URL) {
    log('Error: DATABASE_URL environment variable not set. Cannot run migrations.', 'db-migrate-error');
    process.exit(1);
  }

  try {
    // Ensure the database connection is available before migrating
    await pool.query('SELECT 1'); // Simple query to test connection
    log('Database connection verified.', 'db-migrate');

    // Run the migrations
    await migrate(db, { migrationsFolder: migrationsFolder });

    log('Database migrations applied successfully.', 'db-migrate');
  } catch (error: any) {
    log(`Error running database migrations: ${error.message}`, 'db-migrate-error');
    console.error("Migration Error Details:", error);
    process.exit(1); // Exit with error code
  } finally {
    // Always close the pool connection
    log('Closing database connection pool after migration attempt.', 'db-migrate');
    await pool.end().catch(err => {
        log(`Error closing pool after migration: ${err.message}`, 'db-migrate-error');
    });
  }
}

// Execute the migration function when the script is run
runMigrations();
