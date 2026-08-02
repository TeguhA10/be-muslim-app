-- Migration: 003_add_parent_id_to_comments.sql
ALTER TABLE post_comments 
ADD COLUMN IF NOT EXISTS parent_id UUID NULL REFERENCES post_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON post_comments(parent_id);
