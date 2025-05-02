-- Run this script as a PostgreSQL superuser (e.g., postgres)
-- Replace 'ai_govern_user' with your actual database user name

-- Create the schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS public;

-- Grant privileges to the user
GRANT ALL ON SCHEMA public TO ai_govern_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ai_govern_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ai_govern_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ai_govern_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TYPES TO ai_govern_user;

-- You may also need to set ownership of the schema
ALTER SCHEMA public OWNER TO ai_govern_user;

-- If needed, you can also grant superuser privileges (use with caution)
-- ALTER USER ai_govern_user WITH SUPERUSER;