# 🌙 Muslim Application - Backend API (`be-muslim-app`)

[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5%2F6-blue.svg)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v4.21-lightgrey.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL+PostGIS-v15+-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-v7+-red.svg)](https://redis.io/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](#license)

Backend Service RESTful API komprehensif untuk **Muslim Application** yang melayani fitur Jadwal Sholat, Komunitas / Social Media Feed, Pencarian Masjid Terdekat berbasis **PostGIS**, Arah Kiblat, Kalender Hijriah, dan Notifikasi Adzan Otomatis.

Didesain untuk skala **High Concurrency (1.000+ hingga 100.000+ pengguna simultan)** dengan menerapkan standar keamanan internasional **OWASP Top 10 API Security**.

---

## 🚀 Fitur Utama & Keunggulan Arsitektur

- 🕌 **Jadwal Sholat & Penanggalan Hijriah Presisi**:
  - Integrasi [Aladhan API](https://aladhan.com/prayer-times-api) dengan caching **Redis** (TTL 24 Jam).
  - Penanganan zona waktu (*Timezone Resilience*) yang akurat untuk WIB, WITA, WIT, dan Internasional.

- 📱 **Social Feed & Komunitas Muslim**:
  - Feed dengan **Atomic Counter Denormalization** (`like_count`, `comment_count`) yang meningkatkan kecepatan query feed hingga 90%.
  - Dukungan **Direct Presigned Media Upload** ke Cloudinary CDN (`GET /api/v1/posts/upload-signature`), menghemat bandwidth dan memori server Express.
  - Komentar Bertingkat (*Threaded Comments*) & Fitur Hapus Sampah (*Soft Delete & Retention Purge*).

- 🧭 **Pencarian Masjid Geospasial Sub-Milidetik (`PostGIS`)**:
  - Menggunakan ekstensi **PostGIS** dengan tipe data `GEOGRAPHY(Point, 4326)` dan **GiST Indexing**.
  - Kueri radius `ST_DWithin` & `ST_Distance` yang berjalan sangat cepat walau pada jutaan baris data masjid.
  - Multi-tier caching: **Redis Cache -> PostGIS Local DB -> Overpass OSM Fallback**.

- 🔔 **Notifikasi Push Adzan & Broadcast Realtime**:
  - Scheduler otomatis terpisah untuk pengiriman notifikasi waktu sholat.
  - Skrip broadcast massal untuk pengumuman pengguna via **Firebase Cloud Messaging (FCM)** dan **Socket.IO Realtime**.

- 🛡️ **Keamanan Berstandar OWASP Top 10**:
  - **Tiered Rate Limiting**: Batas request terkonfigurasi dinamis via `.env` (Global & Auth Limiter).
  - **Helmet Security Headers**: HTTPS HSTS, XSS Input Sanitizer, dan CORS Origin Control.
  - **JWT Session Management**: Token blacklist di Redis untuk penanganan logout seketika (*instant revocation*).

---

## 🛠️ Tech Stack & Library

| Kategori | Teknologi / Library |
| :--- | :--- |
| **Runtime & Language** | Node.js (v20+), TypeScript (v6.x) |
| **Web Framework** | Express.js v4.21 |
| **Database & Spatial** | PostgreSQL (v15+) + PostGIS Extension, `pg` driver |
| **Caching Layer** | Redis (v7+), `redis` client |
| **Media & File Storage** | Cloudinary API, Multer |
| **Push Notification & Realtime** | Firebase Admin SDK (FCM), Socket.IO, `node-cron` |
| **Load Testing Suite** | k6 Load Tester (`load_test.js`) |
| **Validation & Security** | Zod, Helmet, bcryptjs, jsonwebtoken, express-rate-limit |

---

## 🏗️ Arsitektur Proyek (Clean Layered Architecture)

```
be-muslim-app/
├── db/
│   ├── migrations/             # 001 - 009 SQL Migration Scripts (PostGIS, Denormalization, Compound Indexes)
│   └── seeds/                  # SQL Seed Data (Islamic Events, Demo Users)
├── load_test.js                # Skrip Pengujian Beban k6 (Simulasi 500 - 2.000 VUs)
├── src/
│   ├── config/                 # Config Database (PG + PostGIS), Redis, Socket.IO, & Multi-Env
│   ├── controllers/            # Request Handlers (Auth, Post, Prayer, Masjid, Notification)
│   ├── db/                     # Script Migrasi Database (npm run migration:up)
│   ├── middlewares/            # Auth JWT, Input Sanitizer XSS, Upload Multer, Global Error Handler
│   ├── models/                 # Interfaces & Data Models
│   ├── routes/                 # Routing Endpoint API Express v1
│   ├── schedulers/             # Cron Job Adzan & Daily Data Retention Cleanup
│   ├── services/               # Logic Bisnis (Aladhan, Overpass, Cloudinary, Auth, Post, Notification)
│   ├── utils/                  # Date Formatter, Logger Winston, API Response Helpers
│   ├── app.ts                  # Setup Express App & Security Middlewares
│   └── server.ts               # Server Entry Point
├── .env.development            # Config Mode Local Development
├── .env.staging                # Config Mode Staging Testing
├── .env.production             # Config Mode Production Live
└── package.json
```

---

## 🌐 Mode Lingkungan Kerja (Multi-Environment)

Aplikasi mendukung 3 mode lingkungan yang terpisah secara bersih:

| Mode | Command | File Env | Deskripsi |
| :--- | :--- | :--- | :--- |
| **Local (Development)** | `npm run dev` | `.env.development` | Menggunakan PostgreSQL & Redis lokal dengan rate limit longgar untuk pengujian. |
| **Staging (Testing QA)** | `npm run dev:staging` | `.env.staging` | Menggunakan server database staging dengan rate limit menengah. |
| **Production (Live)** | `npm run start:prod` | `.env.production` | Menggunakan PgBouncer, Redis Cluster, dan proteksi OWASP sangat ketat. |

---

## 💻 Cara Menjalankan Secara Lokal

### Prasyarat:
- **Node.js** v20+ & **npm**
- **PostgreSQL** (v15+) dengan ekstensi **PostGIS**
- **Redis** (v7+)

### Langkah Instalasi:

1. **Clone Repository & Masuk ke Direktori**:
   ```bash
   git clone https://github.com/TeguhA10/be-muslim-app.git
   cd be-muslim-app
   ```

2. **Install Dependency**:
   ```bash
   npm install
   ```

3. **Konfigurasi Environment**:
   Salin `.env.example` ke `.env.development` (atau `.env`):
   ```bash
   cp .env.example .env.development
   ```

4. **Eksekusi Migrasi Database & Seeding**:
   ```bash
   # Inisialisasi database
   npm run db:setup

   # Jalankan migrasi tabel SQL (001 - 009)
   npm run migration:up
   ```

5. **Jalankan Server**:
   ```bash
   npm run dev
   ```
   Server API berjalan di: `http://localhost:5000/api/v1`

---

## 🧪 Skrip Pengujian Beban (k6 Load Testing)

Menyimulasikan hingga 2.000 pengguna bersamaan (*Virtual Users*):
```bash
# Jalankan load test dengan k6
k6 run load_test.js
```

---

## 📜 Skrip NPM yang Tersedia

| Skrip | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server mode development (`.env.development`) |
| `npm run dev:staging` | Menjalankan server mode staging (`.env.staging`) |
| `npm run build` | Kompilasi TypeScript ke JavaScript bersih di folder `dist/` |
| `npm run start` | Menjalankan server dari hasil kompilasi `dist/server.js` |
| `npm run start:prod` | Menjalankan mode produksi (`.env.production`) |
| `npm run migration:up` | Menjalankan seluruh skrip migrasi database SQL |

---

## 📄 Lisensi

Distributed under the **ISC License**. Lihat `LICENSE` untuk informasi lebih lanjut.
