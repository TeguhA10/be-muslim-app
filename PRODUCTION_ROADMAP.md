# 🛠️ Backend Production Readiness Roadmap & GitHub Issues (`be-muslim-app`)

Dokumen ini berisi daftar kendala (Issues) dan rekomendasi solusi teknis untuk mempersiapkan backend **Muslim App** agar tangguh menangani ribuan pengguna (*high concurrency & production scale*).

---

## 📌 List Issue & Solusi Teknis

### 1. 🚨 Refactor Cron Scheduler to Dedicated Worker / Queue (BullMQ)
- **Kategori**: Scalability & Reliability
- **Deskripsi Masalah**:
  Saat ini `adzan.scheduler.ts` menggunakan `node-cron` yang berjalan langsung di dalam proses HTTP API Express (`server.ts`). Jika aplikasi di-deploy dengan *horizontal scaling* (misal 3 container di belakang NGINX / Load Balancer), Cron Job akan berjalan 3x dan memicu pengiriman notifikasi adzan duplikat ke pengguna.
- **Saran Solusi**:
  1. Pisahkan scheduler dari HTTP API server.
  2. Gunakan **BullMQ** berbasis Redis sebagai *Job Queue*.
  3. Jalankan 1 dedicated worker process yang bertugas mengeksekusi cron pengiriman push notification FCM.

---

### 2. ⚡ Hardening Overpass & Aladhan External API Rate Limits
- **Kategori**: Performance & Resilience
- **Deskripsi Masalah**:
  API publik Overpass (OpenStreetMap) dan Aladhan gratis memiliki batasan *rate limit* (HTTP 429). Jika ribuan pengguna membuka peta masjid di lokasi geografis yang bervariasi pada jam puncak, request ke Overpass bisa terblokir.
- **Saran Solusi**:
  1. Implementasikan penyimpanan data masjid terdekat ke database lokal PostgreSQL secara bertahap saat user melakukan pencarian.
  2. Perpanjang TTL cache Redis untuk lokasi yang jarang berubah.
  3. Tambahkan mekanisme *circuit breaker* dan *graceful fallback* jika API publik tidak merespons.

---

### 3. 🐘 Database Connection Pooling & Tuning (PgBouncer)
- **Kategori**: Database Infrastructure
- **Deskripsi Masalah**:
  Penggunaan *connection pool* bawaan `node-postgres` dapat menyebabkan *exhaustion* (kehabisan koneksi `max_connections`) ketika mendapat lonjakan ribuan request bersamaan.
- **Saran Solusi**:
  1. Gunakan **PgBouncer** sebagai *connection pooler* terdepan di atas PostgreSQL.
  2. Lakukan tuning konfigurasi PostgreSQL (`max_connections`, `shared_buffers`, `work_mem`).
  3. Tambahkan indeks SQL pada kolom yang sering di-query (`masjid_reviews.masjid_id`, `post_likes.post_id`, `comments.post_id`).

---

### 4. 🐳 Production Deployment & Process Management (PM2 / Docker Cluster)
- **Kategori**: DevOps & Infrastructure
- **Deskripsi Masalah**:
  Backend saat ini berjalan dengan `ts-node-dev` untuk lingkungan pengembangan.
- **Saran Solusi**:
  1. Buat skrip kompilasi JavaScript bersih (`npm run build`).
  2. Siapkan `ecosystem.config.js` untuk **PM2 Cluster Mode** yang memanfaatkan seluruh CPU core server.
  3. Sediakan endpoint health check (`GET /api/v1/health`) untuk Liveness & Readiness probe pada NGINX / Kubernetes.

---

### 5. 🛡️ Security Audit & Request Sanitization
- **Kategori**: Security
- **Deskripsi Masalah**:
  Diperlukan proteksi tambahan terhadap serangan otomatis dan kebocoran data sensitif pada skala produksi.
- **Saran Solusi**:
  1. Tambahkan sanitasi input XSS pada isi postingan dan komentar komunitas.
  2. Konfigurasi `cors` origin secara ketat hanya mengizinkan domain/app resmi.
  3. Implementasikan pemantauan log terpusat (misal Sentry / Datadog / ELK Stack) untuk menangkap runtime error secara real-time.
