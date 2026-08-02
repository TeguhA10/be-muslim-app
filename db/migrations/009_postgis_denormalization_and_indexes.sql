-- Migration: 009_postgis_denormalization_and_indexes.sql
-- Enables PostGIS, adds denormalized counters on posts, and creates high-performance indexes

-- 1. Try enabling PostGIS extension (graceful fallback if PostGIS is not installed locally)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'PostGIS extension not available, falling back to standard lat/lng queries.';
END $$;

-- 2. Add geography location column to masjid table if PostGIS extension exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'masjid' AND column_name = 'location'
        ) THEN
            ALTER TABLE masjid ADD COLUMN location GEOGRAPHY(Point, 4326);
            UPDATE masjid SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_masjid_location ON masjid USING GIST(location);
        END IF;
    END IF;
END $$;

-- 3. Add denormalized counter columns to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS like_count INT DEFAULT 0 NOT NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comment_count INT DEFAULT 0 NOT NULL;

-- 4. Backfill counters for existing posts
UPDATE posts p SET like_count = (
    SELECT COUNT(*)::int FROM post_likes pl WHERE pl.post_id = p.id
);

UPDATE posts p SET comment_count = (
    SELECT COUNT(*)::int FROM post_comments pc WHERE pc.post_id = p.id
);

-- 5. High-concurrency compound & cursor indexes
CREATE INDEX IF NOT EXISTS idx_posts_cursor ON posts(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_created ON post_comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_masjid_reviews_masjid_id ON masjid_reviews(masjid_id);
