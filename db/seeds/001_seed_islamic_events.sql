-- Seed: 001_seed_islamic_events.sql

INSERT INTO islamic_events (name, hijri_date, gregorian_date) VALUES
('Tahun Baru Hijriah (1 Muharram)', '01-01', '2026-06-16'),
('Hari Asyura (10 Muharram)', '10-01', '2026-06-25'),
('Maulid Nabi Muhammad SAW (12 Rabiul Awal)', '12-03', '2026-08-25'),
('Isra Mikraj (27 Rajab)', '27-07', '2027-01-05'),
('Nisfu Syaban (15 Syaban)', '15-08', '2027-01-23'),
('Awal Ramadan (1 Ramadan)', '01-09', '2027-02-08'),
('Nuzulul Quran (17 Ramadan)', '17-09', '2027-02-24'),
('Hari Raya Idul Fitri (1 Syawal)', '01-10', '2027-03-10'),
('Hari Raya Idul Adha (10 Zulhijah)', '10-12', '2027-05-17')
ON CONFLICT DO NOTHING;
