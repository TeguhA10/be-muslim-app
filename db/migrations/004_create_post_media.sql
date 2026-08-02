-- Migration: 004_create_post_media.sql
-- Description: Create a new table to store multiple images or links for a post.

CREATE TABLE IF NOT EXISTS post_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('IMAGE', 'LINK')),
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media(post_id);

-- Optional: We can migrate existing single images from posts.image_url to this new table
INSERT INTO post_media (post_id, media_type, url)
SELECT id, 'IMAGE', image_url 
FROM posts 
WHERE image_url IS NOT NULL AND image_url != '';
