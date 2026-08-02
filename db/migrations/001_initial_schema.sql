-- Migration: 001_initial_schema.sql
-- Database Name: muslim_database_app

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT NULL,
    gender VARCHAR(20) NULL,
    birth_date DATE NULL,
    bio TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. User Settings Table (1-to-1 with Users)
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    calculation_method VARCHAR(50) DEFAULT 'KEMENAG' NOT NULL,
    reminder_offset_minutes INT DEFAULT 10 NOT NULL,
    notif_adzan_enabled BOOLEAN DEFAULT true NOT NULL,
    sticky_notif_enabled BOOLEAN DEFAULT false NOT NULL,
    language VARCHAR(10) DEFAULT 'id' NOT NULL
);

-- 3. Posts Table
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    image_url TEXT NULL,
    category VARCHAR(50) DEFAULT 'General' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);

-- 4. Post Likes Table
CREATE TABLE IF NOT EXISTS post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_post_user_like UNIQUE (post_id, user_id)
);

-- 5. Post Comments Table
CREATE TABLE IF NOT EXISTS post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);

-- 6. Follows Table (Self-referencing Many-to-Many)
CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_follower_following UNIQUE (follower_id, following_id)
);

-- 7. Masjid Table (Cache from OpenStreetMap / Google Places)
CREATE TABLE IF NOT EXISTS masjid (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_place_id VARCHAR(255) UNIQUE NULL,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    address TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_masjid_lat_lng ON masjid(latitude, longitude);

-- 8. Masjid Reviews Table
CREATE TABLE IF NOT EXISTS masjid_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    masjid_id UUID NOT NULL REFERENCES masjid(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 9. Islamic Events Table
CREATE TABLE IF NOT EXISTS islamic_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    hijri_date VARCHAR(20) NOT NULL,
    gregorian_date DATE NULL
);

-- 10. Prayer Log Table (Fase 2)
CREATE TABLE IF NOT EXISTS prayer_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prayer_name VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    completed BOOLEAN DEFAULT false NOT NULL,
    CONSTRAINT unique_user_prayer_date UNIQUE (user_id, prayer_name, date)
);
