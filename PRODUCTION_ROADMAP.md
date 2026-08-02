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

---

### 6. 🗺️ Geospatial Indexing (PostGIS) & Cursor-Based Pagination
- **Kategori**: Database & Query Optimization
- **Deskripsi Masalah**:
  Penggunaan B-Tree index pada `(latitude, longitude)` kurang efisien untuk pencarian radius 2D lokasi masjid. Selain itu, `OFFSET` pagination pada Feed Komunitas memperlambat kueri seiring bertambahnya jumlah postingan.
- **Saran Solusi**:
  1. Aktifkan ekstensi `PostGIS` pada PostgreSQL dan gunakan tipe `GEOGRAPHY(Point, 4326)` dengan **GiST Index**.
  2. Tambahkan kolom denormalisasi `like_count` dan `comment_count` pada tabel `posts` untuk menghindari kueri `COUNT(*)` live saat feed di-scroll.
  3. Ubah pagination API dari Offset-based ke **Cursor-Based** (`created_at` / `id` cursor).

---

### 7. 📤 Direct Presigned Media Upload to Cloudinary / Storage
- **Kategori**: Backend Performance & Bandwidth
- **Deskripsi Masalah**:
  Mengunggah file media/gambar postingan melalui server backend Express memakan RAM dan bandwidth server secara signifikan (*bottleneck*).
- **Saran Solusi**:
  1. Buat endpoint backend penjelas token `GET /api/v1/posts/upload-signature` (Cloudinary signed upload params).
  2. Biarkan aplikasi mobile mengunggah file gambar secara langsung dari perangkat client ke Cloudinary CDN.

---

### 8. 🔄 Socket.IO Redis Adapter for Horizontal Scaling
- **Kategori**: Realtime & Clustering
- **Deskripsi Masalah**:
  Dalam mode PM2 Cluster atau multi-container Docker, koneksi WebSocket Socket.IO tidak saling terhubung antar worker process.
- **Saran Solusi**:
  1. Integrasikan `@socket.io/redis-adapter` berbasis Redis Pub/Sub untuk menyinkronkan event realtime ke seluruh instance server.

---

### 9. 🧪 Automated Load & Stress Testing (k6)
- **Kategori**: Quality Assurance & Performance Tuning
- **Deskripsi Masalah**:
  Perlu pengujian kapasitas beban server (*stress testing*) sebelum perilisan resmi untuk mengetahui batas *throughput* (RPS) backend.
- **Saran Solusi**:
  1. Buat skrip pengujian beban k6 (`load_test.js`) di repository `be-muslim-app`.
  2. Simulasikan skenario 500 - 5.000 Virtual Users (VU) bersamaan untuk endpoint auth, feed, dan jadwal sholat.

