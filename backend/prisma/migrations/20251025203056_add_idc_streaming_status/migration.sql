-- Add IDC to StreamingStatus enum for TikTok datacenter detection
ALTER TYPE "StreamingStatus" ADD VALUE IF NOT EXISTS 'IDC';
