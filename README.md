## Solid CV Review – Backend

REST API yang melayani aplikasi Solid CV Review. Dibangun dengan:

- Express + TypeScript
- Sequelize ORM (MySQL/MariaDB)
- JWT + Refresh Token
- Nodemailer untuk email (password reset & verifikasi)

### 🚀 Menjalankan Server

```bash
cd solid-cv-be
npm install
npm run dev
# server berjalan di http://localhost:8000 (default)
```

### ⚙️ Environment

Salin `.env.example` menjadi `.env` kemudian isi:

```
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=

JWT_SECRET=
JWT_EXPIRES_IN=86400
REFRESH_TOKEN_EXPIRES_IN=604800

EMAIL_HOST=
EMAIL_PORT=
EMAIL_SECURE=true
EMAIL_USERNAME=
EMAIL_PASSWORD=
EMAIL_FROM="Solid CV Review <no-reply@domain.com>"

CLIENT_URL=http://localhost:3000
```

Pastikan tabel `users` memiliki kolom:

```
emailVerified BOOLEAN NOT NULL DEFAULT 0
emailVerificationToken VARCHAR(128)
emailVerificationExpires DATETIME
```

Tambahkan via migration atau manual `ALTER TABLE`.

### 📌 Endpoint Ringkas

- `POST /api/auth/register` – register + kirim email verifikasi
- `POST /api/auth/login` – login (mengembalikan access token + set refresh cookie)
- `POST /api/auth/refresh` / `POST /api/auth/logout`
- `POST /api/auth/verify-email` – aktivasi token verifikasi
- `POST /api/auth/resend-verification` – kirim ulang email verifikasi
- `POST /api/auth/forgotPassword` + `PUT /api/auth/resetPassword/:token`
- `GET /api/settings/me` – profil + status verifikasi
- `PUT /api/settings/profile/password/notifications` – update data user

### ✅ Checklist Backend

- [x] Autentikasi JWT + Refresh token
- [x] Registrasi dengan email verifikasi (kirim + verify + resend)
- [x] Middleware protect untuk routes privat
- [x] Endpoints settings/profile/password
- [x] Nodemailer untuk email reset/verifikasi
- [ ] CRUD riwayat analisis CV (masih dummy di frontend)
- [ ] API generator ringkasan/cover letter/interview (belum tersedia)
- [ ] Background job pemrosesan CV/AI

### 🗄️ Struktur Penting

- `src/app.ts` – konfigurasi Express, CORS, middleware
- `src/controllers/*` – logic auth/settings
- `src/routes/*` – definisi route
- `src/models/*` – Sequelize models (User, RefreshToken, dst.)
- `src/database.ts` – koneksi Sequelize

### 🔍 Testing & Lint

Belum ada test. Gunakan `npm run dev` untuk menjalankan server dalam mode watch. Jalankan `npm run lint` jika ditambahkan di masa depan.

---

Frontend README berada di `../solid-cv/README.md`. Jalankan backend lebih dulu sebelum membuka UI.
