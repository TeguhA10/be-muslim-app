-- Migration: 010_add_scalability_indexes.sql
-- High-concurrency database indexes for production scalability (10k+ concurrent users)

-- 1. High-concurrency compound & filtered indexes for feed queries
CREATE INDEX IF NOT EXISTS idx_posts_active_created ON posts (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_user_active ON posts (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_category_created ON posts (category, created_at DESC) WHERE deleted_at IS NULL;

-- 2. Indexes for instant Likes & Bookmarks lookup
CREATE INDEX IF NOT EXISTS idx_post_likes_post_user ON post_likes (post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_post_bookmarks_user_post ON post_bookmarks (user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_masjid_bookmarks_user_masjid ON masjid_bookmarks (user_id, masjid_id);

-- 3. Indexes for Prayer Logs & User Stats
CREATE INDEX IF NOT EXISTS idx_prayer_logs_user_date ON prayer_log (user_id, date);

-- 4. Indexes for Post Media & Comments hierarchy
CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media (post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_parent ON post_comments (post_id, parent_id, created_at ASC);
