-- Seed: 002_seed_demo_user.sql

INSERT INTO users (id, name, email, password_hash)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Ahmad Hidayat',
    'ahmad@example.com',
    '$2a$10$abcdefghijklmnopqrstuu'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO user_settings (user_id, calculation_method, reminder_offset_minutes, notif_adzan_enabled, language)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'KEMENAG',
    10,
    true,
    'id'
) ON CONFLICT (user_id) DO NOTHING;

INSERT INTO masjid (id, name, latitude, longitude, address)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'Masjid Agung Sunda Kelapa',
    -6.198,
    106.818,
    'Jl. Taman Sunda Kelapa No.16, Menteng'
) ON CONFLICT (id) DO NOTHING;
