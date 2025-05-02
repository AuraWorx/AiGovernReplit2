#!/usr/bin/env node

// Using ES modules syntax
import { config } from 'dotenv';
import { execSync } from 'child_process';

// Load environment variables
config();

// Verify DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set in your environment');
  console.error('Make sure you have a .env file with DATABASE_URL=postgresql://...');
  process.exit(1);
}

// Perform database setup
try {
  console.log('Running database migration...');
  execSync('npm run db:push', { stdio: 'inherit' });
  
  console.log('Seeding the database...');
  execSync('npm run db:seed', { stdio: 'inherit' });
  
  console.log('Database setup completed successfully!');
} catch (error) {
  console.error('Error during database setup:', error.message);
  
  console.log('\nTroubleshooting steps:');
  console.log('1. Check if your database user has the proper permissions:');
  console.log('   - Connect to PostgreSQL as a superuser');
  console.log('   - Run: GRANT ALL ON SCHEMA public TO your_db_user;');
  console.log('   - Run: GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_db_user;');
  console.log('2. Verify your DATABASE_URL has the correct format:');
  console.log('   - postgresql://username:password@hostname:port/database_name');
  console.log('3. Make sure your PostgreSQL server is running and accessible');
  
  process.exit(1);
}