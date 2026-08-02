-- Migration: 003_add_masjid_bookmarks.sql

CREATE TABLE IF NOT EXISTS masjid_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    masjid_id UUID NOT NULL REFERENCES masjid(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_masjid_user_bookmark UNIQUE (masjid_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_masjid_bookmarks_user ON masjid_bookmarks(user_id);
