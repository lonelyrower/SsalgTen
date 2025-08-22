-- CreateTable: refresh_tokens
CREATE TABLE IF NOT EXISTS "public"."refresh_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "revoked" BOOLEAN NOT NULL DEFAULT FALSE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_tokenHash_key" ON "public"."refresh_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "refresh_tokens_userId_idx" ON "public"."refresh_tokens"("userId");
CREATE INDEX IF NOT EXISTS "refresh_tokens_expiresAt_idx" ON "public"."refresh_tokens"("expiresAt");

-- Foreign Key
ALTER TABLE "public"."refresh_tokens" 
  ADD CONSTRAINT IF NOT EXISTS "refresh_tokens_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "public"."users"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;

