# 🌙 Muslim Application - Backend API (`be-muslim-app`)

[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5%2F6-blue.svg)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v4.21-lightgrey.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v15+-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-v7+-red.svg)](https://redis.io/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](#license)

Backend Service RESTful API komprehensif untuk **Muslim Application** yang melayani fitur Jadwal Sholat, Komunitas / Social Media Feed, Pencarian Masjid Terdekat, Arah Kiblat, Kalender Hijriah, dan Notifikasi Adzan Otomatis.

---

## 🚀 Fitur Utama

- 🕌 **Jadwal Sholat & Kalender Hijriah**:
  - Integrasi [Aladhan API](https://aladhan.com/prayer-times-api) dengan dukungan berbagai metode perhitungan (Kemenag RI, Muslim World League, ISNA, Egypt, Makkah, dll).
  - Caching agresif menggunakan **Redis** untuk performa super cepat.
  - Penanggalan Hijriah & Daftar Hari Besar Islam (Event Islam).

- 📱 **Social Feed & Komunitas Muslim**:
  - CRUD Postingan dengan dukungan **Multiple Image Upload** via **Cloudinary**.
  - Fitur Like/Unlike, Bookmark Postingan, dan Komentar Bertingkat (*Threaded / Nested Comments*).
  - Feed timeline global dan feed personal pengguna.

- 🧭 **Pencarian & Ulasan Masjid (Mosque Finder)**:
  - Integrasi **Overpass API (OpenStreetMap)** untuk mencari masjid terdekat berdasarkan koordinat geolokasi (latitude & longitude) pengguna.
  - Caching geolokasi pada Redis untuk meminimalkan *latency* API eksternal.
  - Fitur Bookmark Masjid dan Ulasan & Rating Masjid oleh komunitas.

- 🔔 **Pengingat Adzan Otomatis (Push Notification)**:
  - Schedulers internal berbasis `node-cron` yang mendeteksi waktu sholat mendatang.
  - Notifikasi push real-time ke aplikasi mobile via **Firebase Cloud Messaging (FCM)**.

- 🔐 **Keamanan & Manajemen Pengguna**:
  - Autentikasi berstandar industri dengan **JWT (JSON Web Token)** dan Hashing Password **bcryptjs**.
  - Validasi schema input ketat menggunakan **Zod**.
  - Perlindungan keamanan API dengan **Helmet**, **CORS**, dan **Express Rate Limit**.

---

## 🛠️ Tech Stack & Library

| Kategori | Teknologi / Library |
| :--- | :--- |
| **Runtime & Language** | Node.js (v20+), TypeScript (v6.x) |
| **Web Framework** | Express.js v4.21 |
| **Database & ORM/Driver** | PostgreSQL (v15+), `pg` (node-postgres) |
| **Caching Layer** | Redis (v7+), `redis` client |
| **Media & File Storage** | Cloudinary API, Multer |
| **Push Notification** | Firebase Admin SDK (FCM), `node-cron` |
| **Email Service** | Nodemailer |
| **Validation & Security** | Zod, Helmet, bcryptjs, jsonwebtoken, express-rate-limit |
| **Logging & Utility** | Winston Logger, Axios |

---

## 🏗️ Arsitektur Proyek (Clean Layered Architecture)

Proyek ini menerapkan pola *Layered Architecture* yang terisolasi dengan rapi:

```
be-muslim-app/
├── db/
│   ├── migrations/             # SQL Migration Scripts (Initial Schema, Bookmarks, Media, Reviews)
│   └── seeds/                  # SQL Seed Data (Islamic Events, Demo Users)
├── scratch/                    # Test scripts & diagnostic suites
├── src/
│   ├── config/                 # Konfigurasi Database (PG), Redis, dan Environment
│   ├── constants/              # App Constants & Presets
│   ├── controllers/            # Request Handlers (Auth, Post, Prayer, Masjid)
│   ├── db/                     # Script Inisialisasi DB & Runner Migrasi (migration:up)
│   ├── middlewares/            # Auth JWT, Upload Multer, & Error Handler Global
│   ├── models/                 # Interfaces & Type Definitions
│   ├── repositories/           # Layer Akses Data SQL & Redis Cache
│   ├── routes/                 # Routing Endpoint API Express
│   ├── schedulers/             # Cron Job Notifikasi Push Adzan (FCM)
│   ├── services/               # Logic Bisnis (Aladhan, Overpass, Cloudinary, Auth, Post, Email, FCM)
│   ├── utils/                  # Logger Winston & Formatter Response API
│   ├── app.ts                  # Setup App Express & Middlewares
│   └── server.ts               # Server Entry Point (Port Listener & Process Handler)
├── .env.example                # Template Variabel Lingkungan
├── Dockerfile                  # Production Docker Container Specification
├── docker-compose.yml          # Container Service (PostgreSQL & Redis)
├── package.json
└── tsconfig.json               # Konfigurasi TypeScript (Node16 Module Resolution)
```

---

## ⚙️ Variabel Lingkungan (`.env`)

Buat file `.env` di root direktori proyek dengan menyalin contoh dari `.env.example`:

```env
# Server
PORT=5000
NODE_ENV=development

# Database PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=muslim_database_app

# Redis Cache
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# FCM (Firebase Cloud Messaging)
FIREBASE_SERVICE_ACCOUNT_PATH=./path-to-firebase-key.json
```

---

## 💻 Cara Menjalankan Secara Lokal

### Prasyarat
- **Node.js** v20 atau lebih baru
- **npm** atau **yarn**
- **Docker & Docker Compose** (Opsional untuk menjalankan PostgreSQL & Redis cepat)

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

3. **Jalankan PostgreSQL & Redis (Docker Compose)**:
   ```bash
   docker-compose up -d
   ```

4. **Eksekusi Migrasi Database & Seeding**:
   ```bash
   # Buat database jika belum ada
   npm run db:setup

   # Jalankan skrip migrasi tabel
   npm run migration:up
   ```

5. **Jalankan Server Development**:
   ```bash
   npm run dev
   ```
   Server API akan berjalan di: `http://localhost:5000/api/v1`

---

## 📌 Ringkasan Endpoint API

### 🔐 Autentikasi (`/api/v1/auth`)
| Method | Endpoint | Deskripsi | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/auth/register` | Mendaftar akun baru | ❌ |
| `POST` | `/auth/login` | Login & mendapatkan JWT token | ❌ |
| `GET` | `/auth/me` | Ambil data profil pengguna aktif | 🔐 |
| `PUT` | `/auth/profile` | Update profil & foto avatar | 🔐 |

### 🕌 Jadwal Sholat & Kalender (`/api/v1/prayer`)
| Method | Endpoint | Deskripsi | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/prayer/times` | Ambil jadwal sholat berdasarkan koordinat (lat, lng) & tanggal | ❌ |
| `GET` | `/prayer/hijri` | Ambil penanggalan Hijriah saat ini | ❌ |
| `GET` | `/prayer/events` | Ambil daftar Hari Besar Islam & Event tahunan | ❌ |

### 📱 Social Feed & Postingan (`/api/v1/posts`)
| Method | Endpoint | Deskripsi | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/posts/feed` | Ambil timeline postingan komunitas | 🔓 (Opsional) |
| `POST` | `/posts` | Membuat postingan baru (+ upload gambar) | 🔐 |
| `GET` | `/posts/:id` | Detail postingan lengkap dengan komentar | 🔓 (Opsional) |
| `DELETE`| `/posts/:id` | Menghapus postingan milik pengguna | 🔐 |
| `POST` | `/posts/:id/like` | Toggle Like / Unlike postingan | 🔐 |
| `POST` | `/posts/:id/bookmark` | Toggle Bookmark postingan | 🔐 |
| `POST` | `/posts/:id/comments` | Menambahkan komentar / balasan bertingkat | 🔐 |

### 🧭 Masjid & Lokasi (`/api/v1/masjid`)
| Method | Endpoint | Deskripsi | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/masjid/nearby` | Cari masjid terdekat dari lokasi pengguna | ❌ |
| `GET` | `/masjid/:id` | Detail data & ulasan masjid | ❌ |
| `POST` | `/masjid/:id/reviews` | Tambahkan ulasan & rating masjid | 🔐 |
| `POST` | `/masjid/:id/bookmark` | Simpan masjid ke daftar favorit | 🔐 |

---

## 📜 Skrip NPM yang Tersedia

| Skrip | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server dalam mode development dengan `ts-node-dev` (*auto reload*) |
| `npm run build` | Kompilasi TypeScript ke kode JavaScript di folder `dist/` |
| `npm run start` | Menjalankan build JavaScript di folder `dist/server.js` |
| `npm run db:setup` | Membuat database PostgreSQL `muslim_database_app` |
| `npm run migration:up` | Menjalankan seluruh migrasi SQL |
| `npm run lint` | Menjalankan pengecekan code quality dengan ESLint |

---

## 📄 Lisensi

Distributed under the **ISC License**. Lihat `LICENSE` untuk informasi lebih lanjut.
