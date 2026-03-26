# FinTrack AI - Finance Tracking Application

Aplikasi pelacak keuangan cerdas dengan fitur auto-clustering kategori dan analisis pengeluaran menggunakan AI.

## 🚀 Cara Menjalankan di Komputer Lokal (Local Development)

### 1. Prasyarat
Pastikan Anda sudah menginstal:
*   [Node.js](https://nodejs.org/) (Versi 18 atau lebih baru)
*   NPM (biasanya terinstal bersama Node.js)

### 2. Instalasi
Ekstrak file ZIP atau clone repository ini, lalu buka terminal di folder tersebut:
```bash
npm install
```

### 3. Konfigurasi Variabel Lingkungan (Environment Variables)
1.  Buat file baru bernama `.env` di folder utama (root).
2.  Salin isi dari `.env.example` ke `.env`.
3.  Masukkan **Gemini API Key** Anda ke dalam variabel `GEMINI_API_KEY`. Anda bisa mendapatkannya di [Google AI Studio](https://aistudio.google.com/app/apikey).

### 4. Menjalankan Aplikasi
```bash
npm run dev
```
Buka browser dan akses `http://localhost:3000`.

---

## 🌐 Cara Deploy ke Web Sendiri (Hosting)

### Opsi A: Vercel / Netlify (Sangat Direkomendasikan)
1.  Upload kode ini ke repository **GitHub**.
2.  Hubungkan repository tersebut ke [Vercel](https://vercel.com/) atau [Netlify](https://www.netlify.com/).
3.  **PENTING:** Di pengaturan project (Environment Variables) pada dashboard Vercel/Netlify, tambahkan:
    *   `GEMINI_API_KEY`: (API Key Anda)
4.  Klik **Deploy**.

### Opsi B: Firebase Hosting
Karena aplikasi ini sudah menggunakan Firebase, Anda juga bisa menggunakan Firebase Hosting:
1.  Instal Firebase CLI: `npm install -g firebase-tools`
2.  Login: `firebase login`
3.  Inisialisasi: `firebase init hosting`
4.  Build aplikasi: `npm run build`
5.  Deploy: `firebase deploy --only hosting`

---

## 🔐 Konfigurasi Penting (Wajib Dilakukan)

### 1. Authorized Domains di Firebase
Agar fitur **Login Google** berfungsi di domain baru Anda (misal: `www.web-anda.com` atau domain dari Vercel):
1.  Buka [Firebase Console](https://console.firebase.google.com/).
2.  Pilih proyek Anda: `ai-studio-applet-webapp-be065`.
3.  Buka menu **Authentication** > **Settings** > **Authorized Domains**.
4.  Klik **Add Domain** dan masukkan domain website Anda.

### 2. Google AI Studio API Key
Pastikan API Key Anda memiliki kuota yang cukup untuk menangani permintaan dari pengguna web Anda.

---

## 🛠️ Teknologi yang Digunakan
*   **Frontend:** React 19, Vite, Tailwind CSS 4.
*   **Database & Auth:** Firebase Firestore & Authentication.
*   **AI:** Google Gemini API (@google/genai).
*   **Animasi:** Motion (Framer Motion).
*   **Grafik:** Recharts.
