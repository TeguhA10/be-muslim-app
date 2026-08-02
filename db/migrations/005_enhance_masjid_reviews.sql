-- Migration: 005_enhance_masjid_reviews.sql
-- Database Name: muslim_database_app

-- 1. Add updated_at column to masjid_reviews if not exists
ALTER TABLE masjid_reviews 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 2. Add Unique constraint per (masjid_id, user_id) for UPSERT reviews
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_masjid_review'
    ) THEN
        ALTER TABLE masjid_reviews 
        ADD CONSTRAINT unique_user_masjid_review UNIQUE (masjid_id, user_id);
    END IF;
END $$;

-- 3. Create separate table for Masjid Review Photos
CREATE TABLE IF NOT EXISTS masjid_review_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES masjid_reviews(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_masjid_review_photos_review_id ON masjid_review_photos(review_id);
