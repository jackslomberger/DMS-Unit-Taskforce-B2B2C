# PANDUAN DEPLOYMENT VERCEL (GITHUB) & DIRECT GOOGLE DRIVE INTEGRATION
## Target Penyimpanan Akun: jackslomberger@gmail.com
### Mode: DIRECT BYPASS (Tanpa Google Apps Script)

Dokumentasi ini menjelaskan implementasi deployment aplikasi **Enterprise Document Management System (DMS)** langsung ke **Vercel** melalui **GitHub Repository**, dengan penyimpanan berkas dokumen fisik dan katalog database secara langsung ke akun **Google Drive: `jackslomberger@gmail.com`** tanpa memerlukan perantara Google Apps Script.

---

### 1. Arsitektur Direct Bypass (Vercel ke Google Drive Langsung)

Aplikasi beroperasi secara independen tanpa ketergantungan pada server Apps Script:
- **Frontend SPA (Vercel)**: React + Vite + TypeScript di-hosting di Vercel melalui integrasi GitHub.
- **Direct Google Drive v3 REST API**:
  - Berkas fisik dokumen diunggah langsung (*multipart upload*) ke Google Drive API endpoint (`https://www.googleapis.com/upload/drive/v3/files`).
  - Target akun penyimpanan: **`jackslomberger@gmail.com`**.
  - Folder terstruktur otomatis:
    - Root Repository: **`DMS_ROOT_REPOSITORY`**
    - Project Folder: **`[ProjectCode] - [ProjectName]`**
    - Category Subfolders: 14 Kategori standar (`01_PKS`, `02_NDA`, dst.) + kategori kustom.
- **Database Katalog Dokumen di Drive**:
  - Indeks metadata tersimpan langsung di dalam folder root Google Drive (`dms_metadata_registry.json`) dan disinkronkan secara aman di browser client.
- **Kredensial Super Administrator Portal**:
  - **Email**: `admin@jasindo.co.id`
  - **Password**: `tfb2b2c` (atau `AdminPassword2026!`)
  - **Role**: `SUPER_ADMIN`

---

### 2. Cara Kerja Direct Google Drive Bypass di Vercel

1. Buka aplikasi web Anda yang telah live di Vercel (atau di lokal).
2. Login ke portal DMS dengan email `admin@jasindo.co.id` dan password `tfb2b2c`.
3. Pada bilah atas (*top header*), terdapat tombol **"Hubungkan Drive (jackslomberger@gmail.com)"**.
4. Klik tombol tersebut sekali untuk mengotorisasi Google Drive via akun Google Anda (`jackslomberger@gmail.com`).
5. Status akan berubah menjadi hijau: **`🟢 Drive: jackslomberger@gmail.com (BYPASS AKTIF)`**.
6. Setiap kali Anda menekan tombol **"+ Upload Document"** atau **"+ Buat Project Baru"**:
   - Berkas fisik diunggah langsung ke Google Drive `jackslomberger@gmail.com`.
   - File ID dan tautan preview/download Google Drive fisik resmi langsung tersemat pada dokumen.
   - Dokumen dapat dibuka kapan saja melalui tombol **"🌐 Buka di Drive"** di reader dossier dokumen.

---

### 3. Langkah Push ke GitHub Repository

Buka terminal pada direktori proyek:

```bash
# 1. Inisialisasi Git (jika belum)
git init

# 2. Hubungkan ke repository GitHub Anda
git remote add origin https://github.com/USERNAME_ANDA/NAMA_REPO_DMS.git

# 3. Commit seluruh perubahan
git add .
git commit -m "feat: Direct Google Drive bypass integration for Vercel deployment without Apps Script"

# 4. Push ke branch main
git branch -M main
git push -u origin main
```

---

### 4. Konfigurasi di Vercel

1. Masuk ke [vercel.com](https://vercel.com) dan impor repository GitHub Anda.
2. Pengaturan build otomatis:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Variabel Lingkungan (*Environment Variables*):
   - `VITE_TARGET_DRIVE_EMAIL`: `jackslomberger@gmail.com`
4. Klik **Deploy**.
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
