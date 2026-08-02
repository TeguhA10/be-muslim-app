-- Migration: 007_add_soft_delete_to_posts.sql

-- Add deleted_at column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Partial index for active posts performance
CREATE INDEX IF NOT EXISTS idx_posts_active ON posts(created_at DESC) WHERE deleted_at IS NULL;
