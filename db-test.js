import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the database URL from environment variables
const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

console.log('Testing database connection...');
console.log(`Using database URL: ${DATABASE_URL.replace(/:[^:]*@/, ':****@')}`); // Hide password

// Create a client
const client = new pg.Client({
  connectionString: DATABASE_URL,
});

// Connect to the database
try {
  await client.connect();
  console.log('Successfully connected to the database!');
  
  // Test a simple query
  const result = await client.query('SELECT current_database() as db_name, current_user as user');
  console.log('Connected to database:', result.rows[0].db_name);
  console.log('Connected as user:', result.rows[0].user);
  
  // Close the connection
  await client.end();
  console.log('Connection closed');
} catch (error) {
  console.error('Failed to connect to the database:');
  console.error(error.message);
  
  console.log('\nPossible solutions:');
  console.log('1. Check if your PostgreSQL server is running');
  console.log('2. Verify your DATABASE_URL is correct');
  console.log('3. Ensure your database user has proper permissions');
  console.log('4. If using Neon DB, check that your IP is allowed in the access control settings');
  
  process.exit(1);
}