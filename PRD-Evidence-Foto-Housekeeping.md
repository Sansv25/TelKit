# PRD — Web Evidence Foto Housekeeping (Static, GitHub Pages)

## 1. Latar Belakang
Ada file excel checklist kerja housekeeping (contoh: "Eviden Ruang IOC dan TL TA", "Evident Housekeeping Area Bali") yang berisi banyak sheet. Setiap sheet merepresentasikan satu lokasi/ruang, dengan struktur tabel:

| PEKERJAAN | AKTIVITAS | OBYEK PEKERJAAN | KELAS 1..N (frekuensi kerja) | EVIDENT FOTO KOORDINAT & TIMESTAMP (1..N) |
|---|---|---|---|---|

Saat ini, mengisi bukti foto untuk tiap aktivitas dilakukan manual di Excel — repot untuk upload gambar dan tidak reusable antar periode. Dibutuhkan web sederhana untuk mempercepat proses input foto per aktivitas dan menghasilkan PDF laporan, tanpa backend (100% static, di-hosting di GitHub Pages).

## 2. Tujuan
- User bisa import file excel (multi-sheet) sekali, lalu strukturnya (nama sheet + kolom) tersimpan sebagai **template** yang bisa dipakai berkali-kali (misal tiap bulan, tinggal ganti foto).
- User bisa memilih template (sheet) yang pernah diimpor, lalu upload foto ke slot evidence tiap aktivitas.
- User bisa export hasil akhir (data checklist + foto) menjadi PDF yang meniru struktur tabel excel asli.
- Semua data (template + foto) tersimpan di **localStorage** browser — tidak ada server/database.

## 3. Struktur Data Sumber (hasil analisis file excel yang diberikan)

Setiap sheet punya struktur baris sebagai berikut:
- **Baris header** (biasanya baris 2–3): kolom `PEKERJAAN`, `AKTIVITAS`, `OBYEK PEKERJAAN`, satu atau beberapa kolom `KELAS` (contoh: hanya "KELAS 5", atau "KELAS 1" s/d "KELAS 5" — **jumlahnya beda-beda per sheet**), lalu kolom `EVIDENT FOTO KOORDINAT & TIMESTAMP` yang punya sub-kolom bernomor (1, 2, 3, ... — jumlahnya juga beda-beda per sheet).
- **Baris data** (baris 4 dst.): tiap baris = satu aktivitas kerja.
  - `PEKERJAAN` sering merged cell (nilai hanya muncul sekali di baris pertama, mewakili beberapa baris aktivitas di bawahnya).
  - `OBYEK PEKERJAAN` kadang kosong di baris lanjutan (artinya masih objek yang sama dari baris sebelumnya, atau baris variasi tambahan).
  - Kolom `KELAS` berisi teks frekuensi kerja, contoh: `"1 x sebulan"`, `"2 x seminggu"`.
  - Kolom evidence foto (1..N) pada file sumber **kosong** — ini yang akan diisi user dengan foto di web.

Contoh nyata dari data:

| PEKERJAAN | AKTIVITAS | OBYEK PEKERJAAN | KELAS 1 | KELAS 2 | ... |
|---|---|---|---|---|---|
| Housekeeping | Pembersihan dinding | Dinding | 2 x sebulan | 2 x sebulan | ... |
| *(kosong — masih Housekeeping)* | Pembersihan lantai | Lantai | 5 x seminggu | 5 x seminggu | ... |

## 4. Alur Pengguna (User Flow)

### Langkah 1 — Import Excel
1. User membuka halaman **Import**, upload file `.xlsx` (support multi-sheet).
2. Program membaca semua sheet dalam file menggunakan library parsing excel (client-side, contoh: SheetJS/`xlsx.js`).
3. Untuk tiap sheet, program mendeteksi:
   - Nama sheet.
   - Baris header (mencari baris yang mengandung teks `PEKERJAAN`, `AKTIVITAS`, `OBYEK PEKERJAAN`).
   - Jumlah & label kolom `KELAS` (bisa 1 sampai 5+, ambil sesuai yang ada di sheet).
   - Jumlah slot foto di bawah `EVIDENT FOTO KOORDINAT & TIMESTAMP` (angka 1, 2, 3, ... — ambil jumlah maksimum yang terdeteksi, minimal harus mendukung sampai **20 slot foto** per baris walau di excel sumber jumlahnya lebih sedikit).
   - Baris-baris aktivitas: `PEKERJAAN` (isi nilai merged-cell ke semua baris di bawahnya sampai ketemu nilai `PEKERJAAN` baru), `AKTIVITAS`, `OBYEK PEKERJAAN`, nilai tiap kolom `KELAS`.
4. Hasil parsing tiap sheet disimpan ke **localStorage** sebagai satu "template" (**hanya struktur kolom & baris, TANPA foto**), dengan struktur kurang lebih:
   ```json
   {
     "templateId": "auto-generated",
     "sheetName": "1. Witel Singaraja Kantor TIF",
     "kelasColumns": ["KELAS 1", "KELAS 2", "KELAS 3", "KELAS 4", "KELAS 5"],
     "maxFotoSlots": 20,
     "rows": [
       {
         "rowId": "r1",
         "pekerjaan": "Housekeeping",
         "aktivitas": "Pembersihan dinding",
         "obyekPekerjaan": "Dinding",
         "kelasValues": ["2 x sebulan", "2 x sebulan", "1 x sebulan", "1 x sebulan", "1 x sebulan"],
         "fotos": []
       }
     ]
   }
   ```
5. Setelah import selesai, user diarahkan (atau bisa langsung lanjut) ke halaman daftar template.

### Langkah 2 — Pilih Template
1. Halaman **Daftar Template** menampilkan semua sheet yang sudah pernah diimpor (dibaca dari localStorage), termasuk sheet dari file excel yang berbeda-beda (bisa import banyak file, semua template terkumpul di satu daftar).
2. User klik salah satu template untuk membuka halaman input foto.
3. (Opsional tapi disarankan) User bisa menghapus template yang tidak dipakai, untuk menghemat kapasitas localStorage.

### Langkah 3 — Input Foto
1. Halaman **Input Foto** menampilkan tabel sesuai struktur template terpilih: kolom `PEKERJAAN`, `AKTIVITAS`, `OBYEK PEKERJAAN`, semua kolom `KELAS` yang terdeteksi (read-only, hanya menampilkan info jadwal), dan kolom/area evidence foto.
2. Untuk tiap baris aktivitas, user bisa upload 1 sampai 20 foto ke slot evidence baris tersebut (klik upload / drag-drop, preview thumbnail muncul, bisa hapus/ganti foto per slot).
3. **Foto TIDAK disimpan ke localStorage** — foto hanya disimpan di memory/state aplikasi (RAM) selama sesi browser berjalan. Ini disengaja: menghindari localStorage cepat penuh karena foto berat, dan sesuai kebutuhan bahwa foto memang tidak perlu persist antar sesi.
4. Konsekuensinya: kalau tab/browser ditutup atau di-refresh sebelum export PDF, semua foto yang sudah diupload di sesi itu **hilang** dan harus diupload ulang. Perlu ada peringatan jelas di UI (misal `beforeunload` warning) saat user mencoba menutup/refresh tab padahal ada foto yang belum di-export.
5. Struktur template (kolom, baris) tetap ada dan bisa dipilih lagi kapan saja karena itu yang persist di localStorage — hanya fotonya yang perlu diinput ulang tiap sesi.

### Langkah 4 — Export PDF
1. User klik tombol **Export PDF** di halaman Input Foto.
2. Program generate PDF (client-side, contoh: library `jsPDF` + `html2canvas`, atau `pdfmake`) yang meniru struktur tabel excel asli:
   - Kolom: `PEKERJAAN`, `AKTIVITAS`, `OBYEK PEKERJAAN`, semua kolom `KELAS`, lalu kolom/section `EVIDENT FOTO KOORDINAT & TIMESTAMP` berisi foto-foto yang sudah diupload untuk baris tersebut.
   - `PEKERJAAN` yang sama di beberapa baris berurutan ditampilkan sebagai merged cell (seperti file excel asli), atau minimal dikosongkan di baris lanjutan supaya tetap terbaca sebagai kelompok yang sama.
   - Karena bisa sampai 20 foto per baris, foto ditampilkan sebagai grid kecil (misal 4-5 foto per baris grid) di dalam sel evidence, bukan 20 kolom sejajar (supaya PDF tetap rapi & tidak terlalu lebar).
3. File PDF otomatis ter-download ke device user, nama file mengikuti nama sheet/template.

## 5. Kebutuhan Non-Fungsional
- **100% static / client-side** — tidak ada backend, tidak ada API call ke server. Semua logic (parsing excel, penyimpanan, generate PDF) jalan di browser.
- **Deploy target: GitHub Pages** — hanya file HTML/CSS/JS statis (boleh pakai library via CDN, seperti SheetJS, jsPDF).
- **Penyimpanan dibagi 2 lapisan:**
  - **localStorage**: hanya struktur template (nama sheet, kolom PEKERJAAN/AKTIVITAS/OBYEK/KELAS, daftar baris) — ringan, jauh dari limit localStorage (~5-10MB), aman untuk disimpan permanen.
  - **RAM/state aplikasi (variable JS, bukan localStorage)**: semua foto yang diupload. Tidak persist — hilang saat tab ditutup/refresh. Ini pilihan yang disengaja supaya localStorage tidak pernah kepenuhan oleh foto.
  - Karena foto tidak persist, **kompresi/resize gambar sebelum ditampilkan/diproses tetap disarankan** (misal max 1000px lebar) supaya render di browser tetap ringan dan PDF tidak terlalu besar, meskipun bukan untuk alasan kapasitas localStorage lagi.
  - Perlu **peringatan saat user mencoba menutup/refresh tab** kalau ada foto yang sudah diupload tapi belum di-export ke PDF (misal pakai event `beforeunload`), supaya user tidak kehilangan foto tanpa sadar.
- **Reusable template** — struktur (kolom, baris aktivitas) tersimpan di localStorage terpisah dari foto, jadi template selalu bisa dipilih lagi kapan saja; foto memang diinput ulang tiap sesi kerja (misal tiap bulan pengecekan).

## 6. Halaman / Komponen Utama
1. **Halaman Import** — upload excel, preview hasil parsing sebelum disimpan (opsional tapi disarankan, supaya user bisa cek dulu sebelum konfirmasi).
2. **Halaman Daftar Template** — list semua sheet yang sudah diimpor, dengan tombol buka/hapus.
3. **Halaman Input Foto** — tabel checklist + upload foto per baris/slot.
4. **Fungsi Export PDF** — dipanggil dari halaman Input Foto.

## 7. Batasan & Asumsi
- Deteksi header kolom (PEKERJAAN, AKTIVITAS, OBYEK PEKERJAAN, KELAS, EVIDENT FOTO) mengasumsikan penamaan kolom di excel sumber konsisten seperti contoh yang dianalisis. Kalau ada sheet dengan penamaan header berbeda, kemungkinan perlu penyesuaian logic parsing.
- Maksimal slot foto per baris: **20**, terlepas dari berapa jumlah kolom foto asli di excel sumber.
- Kolom `KELAS` ditampilkan apa adanya (read-only info jadwal), jumlah kolom mengikuti yang terdeteksi di tiap sheet (tidak dipaksa seragam antar template).
- Tidak ada validasi antara jadwal (`KELAS`) dengan foto yang diupload (misal cek apakah foto sesuai tanggal jadwal) — di luar scope versi ini kecuali diminta lebih lanjut.

## 8. Next Step
Dokumen ini siap dipakai sebagai brief untuk tahap eksekusi (AI IDE / development), mencakup:
- Struktur data localStorage (template + foto).
- Library yang disarankan: SheetJS (baca excel), jsPDF + html2canvas atau pdfmake (generate PDF), vanilla JS/HTML/CSS (tanpa framework, sesuai kebutuhan static untuk GitHub Pages).
- Logic parsing header dinamis (kolom KELAS & slot foto yang jumlahnya berbeda tiap sheet).
