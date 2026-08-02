# Muslim Application - Backend API (`be-muslim-app`)

Backend Service API untuk Aplikasi Muslim (Prayer Times, Social Feed, Mosque Finder, Qibla & Islamic Events).

## Tech Stack
- **Runtime**: Node.js v20+ / TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (`muslim_database_app`)
- **Caching**: Redis
- **Authentication**: JWT & Google OAuth 2.0
- **Push Notification**: Firebase Cloud Messaging (FCM)
- **External Integrations**:
  - Aladhan API (Jadwal Sholat & Kalender Hijriah)
  - Overpass API / OpenStreetMap (Pencarian Masjid Terdekat)

---

## Structure Architecture (Clean Layered Architecture)
```
be-muslim-app/
├── db/
│   ├── migrations/             # SQL Migrations (001_initial_schema.sql)
│   └── seeds/                  # Seed Data (001_seed_islamic_events.sql)
├── src/
│   ├── config/                 # Environment, Database, Redis
│   ├── constants/              # App Constants
│   ├── controllers/            # Controller HTTP Handlers (Auth, Prayer, Post, Masjid)
│   ├── middlewares/            # Auth JWT & Error Handling
│   ├── models/                 # TypeScript interfaces (Users, Posts, Masjid, etc.)
│   ├── repositories/           # Data Access Layer (PostgreSQL & Redis)
│   ├── services/               # Business Logic & Third-Party API Proxies
│   ├── schedulers/             # FCM Push Notification Cron Jobs
│   ├── routes/                 # Express Routers
│   ├── utils/                  # Logger, Response Formatters
│   ├── app.ts                  # Express App configuration
│   └── server.ts               # Server entry point
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## Setup & Running Locally

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Setup Environment**:
   Salin `.env.example` ke `.env` dan atur konfigurasi PostgreSQL & Redis:
   ```bash
   cp .env.example .env
   ```

3. **Jalankan PostgreSQL & Redis dengan Docker Compose**:
   ```bash
   docker-compose up -d postgres redis
   ```

4. **Jalankan Migrasi Database**:
   ```bash
   npm run migration:up
   ```

5. **Jalankan Server Development**:
   ```bash
   npm run dev
   ```
   API akan berjalan di `http://localhost:5000/api/v1`.

---

## API Endpoints Overview
- `POST /api/v1/auth/register` - Registrasi pengguna baru
- `POST /api/v1/auth/login` - Login pengguna
- `GET /api/v1/prayer/times?lat=-6.200000&lng=106.816666` - Jadwal Sholat (Aladhan + Cache Redis)
- `GET /api/v1/prayer/hijri` - Tanggal Hijriah
- `GET /api/v1/prayer/events` - Daftar Hari Besar Islam
- `GET /api/v1/posts/feed` - Feed postingan (Social Media)
- `POST /api/v1/posts` - Buat postingan baru
- `GET /api/v1/masjid/nearby?lat=-6.200000&lng=106.816666` - Cari Masjid Terdekat (Overpass API + Cache)
