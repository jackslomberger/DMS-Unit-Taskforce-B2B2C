# ENTERPRISE DOCUMENT MANAGEMENT SYSTEM (DMS)
## Panduan Lengkap Deployment & Arsitektur Penyimpanan 100% Google Drive

Dokumentasi ini menyajikan instruksi komprehensif langkah demi langkah (*end-to-end production deployment*) untuk menerapkan **Enterprise Document Management System (DMS)** pada lingkungan **Google Workspace / Google Apps Script**, dengan penekanan pada **penyimpanan dokumen fisik 100% tersimpan di Google Drive**.

---

### 1. Model & Arsitektur Penyimpanan Dokumen (100% Google Drive Storage)

Aplikasi ini menggunakan arsitektur **Hybrid Dual-Tier Enterprise Architecture**:
1. **Google Drive Storage (100% Physical Binary File Storage)**: Seluruh file asli (PDF, DOCX, XLSX, PNG, JPG, ZIP, dsb.) langsung disimpan secara fisik ke dalam hirarki folder Google Drive.
2. **Google Sheets Database (Relational Indexing & Metadata Engine)**: Menyimpan metadata pencarian, atribut kontrak, tanggal kadaluarsa, hak akses pengguna, token sesi, dan audit log tanpa menyimpan binary base64 di dalam sel (sehingga terhindar dari batasan kuota spreadsheet).

```
                               ┌────────────────────────────────────────┐
                               │     WEB PORTAL DMS (Index.html)        │
                               └──────────────────┬─────────────────────┘
                                                  │
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │    APPS SCRIPT ENGINE (Code.gs)        │
                               │    (RBAC, Token Auth & Business Logic) │
                               └──────────┬───────────────────┬─────────┘
                                          │                   │
                      ┌───────────────────┴───────┐   ┌───────┴───────────────────┐
                      ▼                           │   │                           ▼
    ┌───────────────────────────────────┐         │   │         ┌───────────────────────────────────┐
    │       GOOGLE DRIVE STORAGE        │         │   │         │      GOOGLE SHEETS DATABASE       │
    │   (100% Berkas Fisik Tersimpan)   │         │   │         │     (Index & Metadata Dokumen)    │
    └───────────────────────────────────┘         │   │         └───────────────────────────────────┘
    • Folder Root: DMS_ROOT_REPOSITORY            │   │         • Sheet DOCUMENTS:
      └── [PRJ-2026-001] Siloam Medika 2026       │   │           - documentId (DOC-01, dll)
          ├── 01_PKS (File PDF/DOCX Asli)         │   │           - projectId  (Relasi ke PROJECTS)
          ├── 02_NDA (File PDF/DOCX Asli)         │   │           - driveFileId (ID Unik Berkas Drive)
          ├── ... (14 Kategori Subfolder)         │   │           - metadata (Tgl, Expired, Kategori)
          └── 14_DOKUMEN_LEGALITAS                │   │           - isDeleted, deletedAt (Soft delete)
                                                  │   │         • Sheet PROJECTS, USERS, SESSIONS
                                                  │   │         • Sheet ACTIVITY_LOG (Audit Trail)
```

#### Struktur Hirarki Folder di Google Drive:
- **Root Directory**: `DMS_ROOT_REPOSITORY` (dibuat otomatis di *My Drive* saat fungsi inisialisasi `setupDMS` dijalankan).
- **Project Folder**: Setiap kali Super Admin membuat project baru, folder `[ProjectCode] - [ProjectName]` otomatis dibuat di dalam `DMS_ROOT_REPOSITORY`.
- **14 Subfolder Kategori Standar + Kategori Kustom**: Setiap folder project otomatis dilengkapi dengan 14 subfolder kategori standar:
  1. `01_PKS` (Perjanjian Kerja Sama)
  2. `02_NDA` (Non-Disclosure Agreement)
  3. `03_MOU` (Memorandum of Understanding)
  4. `04_BAK` (Berita Acara Kesepakatan)
  5. `05_POLIS_INDUK` (Polis Induk Asuransi)
  6. `06_QS_SLIP` (Quotation Slip)
  7. `07_KAJIAN_MANAJEMEN_RISIKO`
  8. `08_MEMO` (Memo Internal)
  9. `09_SURAT` (Surat Masuk & Keluar)
  10. `10_KAJIAN_BISNIS`
  11. `11_TECHNICAL_OPERATION`
  12. `12_GUIDE_BOOK` (SOP & Manual)
  13. `13_KORESPONDENSI_EMAIL`
  14. `14_DOKUMEN_LEGALITAS`
  - **Kategori Baru / Kustom**: Apabila saat input project baru atau upload dokumen pengguna memasukkan kategori baru yang belum terdaftar (misal `15. Addendum` atau `16. Berita Acara`), sistem secara dinamis dan otomatis membentuk subfolder untuk kategori baru tersebut di Google Drive dan mendaftarkannya ke dalam taksonomi Document Explorer.

#### Siklus Hidup Dokumen (Document Lifecycle):
1. **Upload**: User mengunggah berkas di web UI -> Berkas dikirim dalam format byte stream -> `DriveService.saveFileToCategoryFolder` membuat file fisik di Google Drive pada subfolder kategori terkait -> Mengembalikan `fileId`, `fileUrl`, `fileSize`, `mimeType` -> Dicatat ke sheet `DOCUMENTS`.
2. **Reader & Streaming**: Saat dokumen dibuka di Document Reader, backend membaca blob dari Google Drive via `DriveApp.getFileById(driveFileId)` dan menyajikannya secara terenkripsi ke browser.
3. **Download**: Pengguna dapat mengunduh berkas fisik asli berformat ekstensi semula langsung dari Drive atau melalui Blob downloader.
4. **Soft Delete & Trash**: Dokumen yang dipindahkan ke *Trash* ditandai di database tanpa merusak berkas Drive sampai masa retensi (30 hari) tercapai.
5. **Purge / Empty Trash**: Saat dihapus permanen, berkas fisik di Google Drive otomatis dipindahkan ke Google Drive Trash (`file.setTrashed(true)`).

---

### 2. Prasyarat (*Prerequisites*)

1. Akun **Google Workspace** (atau akun Google pribadi/korporat dengan akses Google Drive & Google Sheets).
2. Peramban web modern (Google Chrome, Mozilla Firefox, Microsoft Edge, atau Safari).
3. Berkas sumber dari bundle ZIP:
   - `Code.gs` (Backend script)
   - `Index.html` (Frontend single-page web app)
   - `appsscript.json` (Manifest file & OAuth permissions)

---

### 3. Tutorial Langkah Demi Langkah Deployment ke Google Apps Script

#### Langkah 1: Buat Spreadsheet Database Baru
1. Buka [Google Sheets](https://sheets.new) di browser Anda.
2. Beri nama spreadsheet: **`DMS_DATABASE_MASTER`**.
3. Di menu bar atas, klik **Extensions (Ekstensi)** > **Apps Script**.
4. Beri nama project Apps Script: **`Enterprise Document Management System`**.

#### Langkah 2: Aktifkan Tampilan File Manifes (`appsscript.json`)
1. Di bilah menu kiri Apps Script editor, klik ikon roda gigi **Project Settings (Setelan Project)**.
2. Centang kotak: **"Show 'appsscript.json' manifest file in editor"** (Tampilkan file manifes 'appsscript.json' dalam editor).
3. Kembali ke tab **Editor** (`< >`).

#### Langkah 3: Salin Berkas Kode Sumber
1. Buka berkas **`appsscript.json`** di editor Apps Script, lalu ganti seluruh isinya dengan konten dari berkas `appsscript.json`.
2. Buka berkas **`Code.gs`**, lalu ganti seluruh isinya dengan konten dari berkas `Code.gs`.
3. Klik tombol **+** di samping tulisan "Files" > pilih **HTML** > beri nama **`Index`** (otomatis menjadi `Index.html`).
4. Tempel seluruh isi berkas `Index.html` ke dalamnya.
5. Klik ikon disket **Save project (Simpan project)** (atau tekan `Ctrl + S`).

#### Langkah 4: Jalankan Inisialisasi Database & Folder Drive (`setupDMS`)
1. Pada menu dropdown fungsi di toolbar atas editor Apps Script, pilih fungsi **`setupDMS`**.
2. Klik tombol **Run (Jalankan)**.
3. Google akan menampilkan dialog otorisasi (*Authorization Required*):
   - Klik **Review Permissions** > pilih akun Google Anda.
   - Klik tautan kecil **Advanced** di kiri bawah > klik **Go to Enterprise Document Management System (unsafe)**.
   - Klik **Allow (Izinkan)**.
4. Fungsi `setupDMS` akan secara otomatis:
   - Membuat 8 sheet database relasional berformat enterprise: `CONFIG`, `USERS`, `SESSIONS`, `PROJECTS`, `DOCUMENTS`, `ACTIVITY_LOG`, `FAVORITES`, `RECENTS`.
   - Mengatur styling header sheet (Navy `#0A192F`, huruf putih tebal, *frozen row*).
   - Membuat folder root **`DMS_ROOT_REPOSITORY`** pada Google Drive Anda.
   - Mencatat log audit pertama `SYSTEM_INITIALIZED`.

#### Langkah 5: Daftarkan Akun Super Administrator Pertama (`bootstrapFirstAdmin`)
1. Pada dropdown fungsi di toolbar atas editor, pilih **`bootstrapFirstAdmin`** (atau jalankan `setupDMS` yang kini otomatis mendaftarkan akun default).
2. Klik **Run**.
3. Secara default, akun Super Admin terdaftar dengan kredensial:
   - **Email**: `admin@jasindo.co.id`
   - **Password / Access Key**: `tfb2b2c` (atau `AdminPassword2026!`)
   - Role: `SUPER_ADMIN`
   - Status: `ACTIVE`

#### Langkah 6: Pasang Otomasi Trigger Harian (`installTriggers`)
1. Pada dropdown fungsi, pilih **`installTriggers`**.
2. Klik **Run**.
3. Sistem otomatis memasang 2 cron trigger terjadwal:
   - **`dailyRetentionPurgeJob`**: Berjalan otomatis pukul 02:00 pagi setiap hari untuk mempurge file di Trash yang melewati masa retensi (default 30 hari).
   - **`dailyContractExpiryJob`**: Berjalan otomatis pukul 06:00 pagi setiap hari untuk mendeteksi dokumen yang mendekati tanggal kadaluarsa.

#### Langkah 7: Publikasikan sebagai Web App (Deploy)
1. Klik tombol biru **Deploy** di pojok kanan atas > pilih **New deployment (Penyebaran baru)**.
2. Klik ikon roda gigi di samping *Select type* > pilih **Web app**.
3. Isi konfigurasi penyebaran:
   - **Description**: `Enterprise DMS Production v1.11.0`
   - **Execute as (Jalankan sebagai)**: **`Me (email_anda@domain.com)`**  
     *(PENTING: Pilih "Me" agar backend mengeksekusi operasi pembuatan folder & file di Google Drive atas nama Service Owner)*.
   - **Who has access (Siapa yang memiliki akses)**:
     - Untuk lingkungan internal: `Anyone within [Domain Anda]`
     - Untuk akses fleksibel/lintas unit: `Anyone (Siapa saja)`
4. Klik **Deploy**.
5. Salin tautan **Web App URL** yang muncul (format: `https://script.google.com/macros/s/AKfycb.../exec`).
6. Web Apps Enterprise DMS siap digunakan oleh seluruh personil!

---

### 4. Konfigurasi Keamanan Tambahan di Lingkungan Produksi

1. **Rotasi Salt/Pepper Kriptografi**:
   - Untuk keamanan enkripsi kata sandi maksimal, Anda dapat menyetel Script Property:
     - Masuk ke *Project Settings* > *Script Properties* > *Add script property*.
     - Properti: `DMS_PEPPER`
     - Nilai: string acak minimal 32 karakter (misal: `k9F#mQ2$zL8*vW4!xT7@jR1^pC5&hY3`).
2. **Folder Drive Root Kustom (Opsional)**:
   - Jika Anda ingin menempatkan root repository di Shared Drive atau folder tertentu yang sudah ada:
     - Tambahkan Script Property: `ROOT_FOLDER_ID` = `[ID_FOLDER_GOOGLE_DRIVE_ANDA]`.

---

### 5. Ringkasan File Paket Deployment

| Berkas | Fungsi Utama |
|---|---|
| `Code.gs` | Backend Core Engine: Google Drive Storage Adapter, Sheets DB CRUD, Auth & RBAC, Search, Audit Logging |
| `Index.html` | Frontend Single Page App: Explorer 3-Panel, Reader, Smart Search, User Management, Settings |
| `appsscript.json` | Manifest Apps Script: Skup OAuth Drive, Sheets, ScriptApp, dan zona waktu Asia/Jakarta |
| `DEPLOYMENT.md` | Panduan lengkap langkah demi langkah deployment dan panduan operasional |
