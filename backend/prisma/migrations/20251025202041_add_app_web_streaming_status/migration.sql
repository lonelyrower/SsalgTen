-- Add APP and WEB to StreamingStatus enum for ChatGPT
ALTER TYPE "StreamingStatus" ADD VALUE IF NOT EXISTS 'APP';
ALTER TYPE "StreamingStatus" ADD VALUE IF NOT EXISTS 'WEB';
