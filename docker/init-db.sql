-- Initialize SsalgTen Database
-- This script is run automatically when the PostgreSQL container starts

-- Create database if not exists (handled by Docker environment)
-- Database 'ssalgten' is created by POSTGRES_DB environment variable

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create initial admin user with hashed password (admin123)
-- This is handled by the Prisma seed process in the backend

-- Set database configuration
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';

-- Reload configuration
SELECT pg_reload_conf();