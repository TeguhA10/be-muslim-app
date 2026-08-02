-- Migration: 008_add_is_purged_to_posts.sql

-- Add is_purged and purged_at columns to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_purged BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS purged_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for cron job cleanup of purged posts
CREATE INDEX IF NOT EXISTS idx_posts_purged ON posts(purged_at) WHERE is_purged = TRUE;
