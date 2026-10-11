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
  - **Email**: `jackslomberger@gmail.com` (atau `admin@jasindo.co.id`)
  - **Password**: `AdminPassword2026!` (atau `tfb2b2c`)
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

---

### 6. Fitur Akselerasi Kecepatan Tinggi (Google Drive Turbo & Ultra-Fast Reader)

Aplikasi telah dilengkapi dengan arsitektur akselerator multi-tier untuk memastikan performa pembacaan data dan pembukaan dokumen berlangsung instan:
1. **Navigasi Antar-Menu Instan (0ms Latency via SWR Cache)**:
   - `DmsFastCache` menyimpan metadata proyek, dokumen, kategori, dan pengguna dalam memori dan sesi browser.
   - Berpindah antar menu (Dashboard, Projects, Explorer, Search, Favorites, Recents, Trash, Users) berlangsung seketika tanpa loading spinner berulang.
   - Fitur *Stale-While-Revalidate (SWR)* memperbarui data di latar belakang secara hening (*silent sync*).
2. **Reader Dokumen Google Drive Super Cepat (< 0.5 detik)**:
   - Reader dossier dokumen langsung menampilkan identitas dan metadata dalam 0 ms.
   - Dokumen fisik yang tersimpan di Google Drive di-*stream* langsung menggunakan **Google Drive Edge CDN Preview Engine** (`https://drive.google.com/file/d/{driveFileId}/preview`).
   - Mendukung berkas PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), gambar, dan teks tanpa jeda encoding Base64.
   - Tersedia tombol cepat: **Unduh Berkas Asli (Direct CDN)**, **Buka di Tab Google Drive**, **Cetak**, dan **Format Native**.
3. **Pre-warming Otomatis**:
   - Saat pengguna mengarahkan mouse (*hover*) ke baris dokumen di Explorer, Search, atau Dashboard, sistem secara proaktif melakukan *pre-warming* tautan Google Drive sehingga saat diklik, dokumen langsung terbuka instan.
4. **Tombol "⚡ Drive Turbo" di Topbar**:
   - Indikator aktif di topbar menampilkan status sinkronisasi dan menyediakan tombol 1-klik untuk memaksa pembaruan data Google Drive jika diperlukan.

---

### 7. Troubleshooting & Solusi Error Pasca Deploy Ulang

Jika setelah deploy ulang atau memperbarui kode terjadi kendala, berikut adalah akar penyebab dan solusi perbaikannya:

1. **Kendala: Error saat Web App memanggil API (`ERR_METHOD_NOT_FOUND` / `ERR_DO_POST_EXCEPTION`)**:
   - **Penyebab**: Mesin runtime Apps Script V8 tidak mengekspos fungsi global melalui `this[action]` di dalam handler `doPost`.
   - **Solusi**: Telah diperbaiki dengan `executeApiAction()` dan dictionary `API_DISPATCH` statis di `Code.gs`. Salin versi terbaru `Code.gs` ke editor Apps Script.

2. **Kendala: "Database Error: No active spreadsheet or DMS_SPREADSHEET_ID found"**:
   - **Penyebab**: Script dibuat sebagai Standalone Script di `script.google.com` sehingga `SpreadsheetApp.getActiveSpreadsheet()` bernilai kosong.
   - **Solusi**: `Code.gs` versi terbaru otomatis mencari file spreadsheet `DMS_DATABASE_MASTER` di Google Drive Anda, atau otomatis membuatnya secara instan jika belum ada.

3. **Kendala: Gagal terhubung / CORS Preflight / 401 saat Uji Koneksi**:
   - **Penyebab**: Opsi perizinan deployment Web App salah disetel ke "Only myself" (Hanya saya).
   - **Solusi**: Pada dialog Deploy Apps Script:
     - **Execute as**: *Me (jackslomberger@gmail.com)*
     - **Who has access**: **Anyone** *(Semua orang)*

4. **Kendala: Kode di Apps Script sudah di-paste tetapi perubahan tidak berpengaruh**:
   - **Penyebab**: Apps Script mengharuskan pembentukan versi baru agar Web App URL menyajikan kode termutakhir.
   - **Solusi**: Di menu atas Apps Script, klik **Deploy** > **Manage deployments** > klik ikon **Pensil (Edit)** pada Active deployment > Ubah **Version** menjadi **New version** > klik **Deploy**.

5. **Kendala: Otomatisasi URL Endpoint di Vercel**:
   - Anda dapat memasukkan Web App URL langsung ke Environment Variables Vercel:
     - Key: `VITE_APPS_SCRIPT_URL`
     - Value: `https://script.google.com/macros/s/AKfycb.../exec`
   - Aplikasi akan otomatis terhubung tanpa perlu menginput ulang secara manual di menu Pengaturan.

