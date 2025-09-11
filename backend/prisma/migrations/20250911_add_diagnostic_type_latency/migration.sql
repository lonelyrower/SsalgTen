-- Extend DiagnosticType enum with LATENCY_TEST to match Prisma schema
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'DiagnosticType' AND n.nspname = 'public'
  ) THEN
    -- Enum does not exist (fresh DB?) — create with expected values
    CREATE TYPE "public"."DiagnosticType" AS ENUM ('PING', 'TRACEROUTE', 'MTR', 'SPEEDTEST', 'LATENCY_TEST');
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'DiagnosticType' AND n.nspname = 'public' AND e.enumlabel = 'LATENCY_TEST'
  ) THEN
    -- Enum exists but missing the value — add it (idempotent)
    BEGIN
      ALTER TYPE "public"."DiagnosticType" ADD VALUE 'LATENCY_TEST';
    EXCEPTION WHEN duplicate_object THEN
      -- value already exists, ignore
      NULL;
    END;
  END IF;
END $$;
