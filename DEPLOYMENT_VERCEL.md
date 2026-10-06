# PANDUAN DEPLOYMENT VERCEL (GITHUB) & GOOGLE DRIVE INTEGRATION
## Target Penyimpanan Akun: jackslomberger@gmail.com

Dokumentasi ini menjelaskan langkah-langkah implementasi untuk men-deploy aplikasi **Enterprise Document Management System (DMS)** ke **Vercel** melalui **GitHub Repository**, serta menghubungkan penyimpanan seluruh berkas dokumen secara penuh ke akun **Google Drive: `jackslomberger@gmail.com`**.

---

### 1. Arsitektur Penyimpanan Google Drive jackslomberger@gmail.com

Aplikasi dirancang dengan arsitektur **Hybrid Enterprise Storage**:
- **Frontend SPA**: Di-hosting pada **Vercel** (berbasis React + Vite + TypeScript) untuk kecepatan akses global, CDN, SSL otomatis, dan uptime tinggi.
- **Backend File Storage (Google Drive)**: Berkas fisik dokumen (PDF, Word, Excel, Gambar, dll.) disimpan 100% ke dalam Google Drive milik **`jackslomberger@gmail.com`**.
  - **Root Directory**: `DMS_ROOT_REPOSITORY`
  - **Project Directory**: `[ProjectCode] - [ProjectName]`
  - **Category Subfolders**: 14 Subfolder standar (`01_PKS`, `02_NDA`, dst.) + subfolder kategori baru kustom.
- **Database & Metadata**: Disimpan di Google Sheets yang terhubung atau Cloud Firestore (`ai-studio-documentmanageme-6b38adcb-1f95-4363-b7d5-b387eafa416d`).

---

### 2. Langkah Menghubungkan Google Drive jackslomberger@gmail.com

Agar Vercel dapat mengunggah file ke Google Drive `jackslomberger@gmail.com`, gunakan metode **Apps Script Web App API Gateway** (Sangat mudah, bebas biaya server GCP/Cloud Run):

1. **Buka Google Apps Script**:
   - Login ke akun Google Anda: **`jackslomberger@gmail.com`**.
   - Buka [script.google.com](https://script.google.com) dan klik **Proyek Baru**.
2. **Salin Kode Sumber Backend**:
   - Ganti isi `Code.gs` dengan seluruh file `Code.gs` dari repository ini (sudah dilengkapi fungsi `doPost` dan `doGet`).
   - Buat file HTML baru dengan nama `Index` dan salin isi file `Index.html`.
3. **Jalankan Inisialisasi**:
   - Pada editor Apps Script, pilih fungsi `setupDMS` pada dropdown toolbar, lalu klik **Jalankan (Run)**.
   - Berikan izin otorisasi (*Review Permissions*) untuk akun `jackslomberger@gmail.com`.
   - Script akan otomatis membuat folder **`DMS_ROOT_REPOSITORY`** dan Google Spreadsheet database di Google Drive Anda.
4. **Deploy sebagai Web App**:
   - Klik tombol biru **Deploy** > **Deployment Baru (New deployment)**.
   - Pilih jenis: **Aplikasi Web (Web App)**.
   - Konfigurasi:
     - **Deskripsi**: `DMS Production API for Vercel`
     - **Jalankan sebagai (Execute as)**: **Saya (`jackslomberger@gmail.com`)** *(PENTING: ini memastikan semua file diunggah atas nama akun Drive Anda)*.
     - **Yang memiliki akses (Who has access)**: **Siapa saja (Anyone)**.
   - Klik **Deploy**, lalu **Salin URL Aplikasi Web** yang dihasilkan (contoh format: `https://script.google.com/macros/s/AKfycb.../exec`).

---

### 3. Langkah Push ke GitHub Repository

Buka terminal pada direktori proyek Anda:

```bash
# 1. Inisialisasi Git (jika belum ada)
git init

# 2. Tambahkan remote repository GitHub Anda
git remote add origin https://github.com/USERNAME_ANDA/NAMA_REPO_DMS.git

# 3. Commit seluruh file
git add .
git commit -m "feat: Enterprise DMS Full Screen layout & Vercel deployment setup"

# 4. Push ke GitHub
git branch -M main
git push -u origin main
```

---

### 4. Langkah Hosting di Vercel

1. **Masuk ke Vercel**:
   - Buka [vercel.com](https://vercel.com) dan login dengan akun GitHub Anda.
2. **Import Repository**:
   - Klik **Add New...** > **Project**.
   - Pilih repository GitHub yang baru saja Anda push.
3. **Konfigurasi Project di Vercel**:
   - **Framework Preset**: `Vite` (Otomatis terdeteksi).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Environment Variables (Opsional namun disarankan)**:
   Tambahkan variabel berikut:
   - `VITE_TARGET_DRIVE_EMAIL`: `jackslomberger@gmail.com`
   - `VITE_APPS_SCRIPT_URL`: *(Tempel URL Web App dari Langkah 2)*
5. **Klik Deploy**:
   - Vercel akan mengompilasi aplikasi dalam hitungan detik.
   - Anda akan mendapatkan URL domain aktif (contoh: `https://nama-dms.vercel.app`).

---

### 5. Penyesuaian Tampilan Full Screen (Tanpa Scrollbar)

1. **Reset CSS Edge-to-Edge**:
   - Halaman root `index.html` dan portal `Index.html` telah disesuaikan dengan `height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden;`.
   - Tidak ada lagi scrollbar jendela browser ganda yang mengganggu seperti pada tampilan sebelumnya.
2. **Tombol Layar Penuh (Fullscreen)**:
   - Pada bar atas terdapat tombol **⛶ Layar Penuh** yang dapat diklik kapan saja untuk memaksimalkan tampilan portal DMS ke resolusi layar penuh tanpa bar browser.
3. **Scrollbar Internal yang Ramping**:
   - Area tabel yang memiliki banyak data pengguna atau dokumen menggunakan scrollbar modern minimalis (5px) transparan yang tidak memakan ruang visual layar.
