-- Migration: 006_create_notifications.sql

-- Add fcm_token / push_token to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(255),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_id, created_at DESC);
