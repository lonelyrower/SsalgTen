-- Add NOPREM and CN to StreamingStatus enum
ALTER TYPE "StreamingStatus" ADD VALUE IF NOT EXISTS 'NOPREM';
ALTER TYPE "StreamingStatus" ADD VALUE IF NOT EXISTS 'CN';
