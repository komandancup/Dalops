# Desain: Aplikasi Pencatatan Warung Pecel Lele & Ayam Penyet

Tanggal: 2026-11-20
Status: Draf, menunggu persetujuan pemilik

## 1. Maksud dan alasan

Warung pecel lele & ayam penyet saat ini mencatat semuanya secara manual. Pesanan pembeli ditulis di buku, dan belanja bahan serta pengeluaran tidak tercatat dengan rapi. Akibatnya, masalah muncul saat melayani (pesanan dan total) dan saat akhir hari atau akhir bulan (omzet, untung, dan uang laci tidak jelas).

Pemilik adalah **investor** yang tidak setiap hari berada di warung. Warung dijalankan oleh **karyawan**. Aplikasi ini punya dua tujuan:

1. **Untuk karyawan:** mencatat pesanan, pembayaran, pengeluaran, dan tutup kas harian dengan cepat dari HP Android pribadi mereka. Prosesnya tidak boleh lebih lambat daripada menulis di buku.
2. **Untuk pemilik:** melihat dari HP sendiri, kapan saja, angka penjualan, pengeluaran, dan uang laci yang **bisa dipercaya**.

"Bisa dipercaya" adalah inti desain ini. Data yang sudah tersimpan tidak boleh hilang atau berubah diam-diam. Setiap pembatalan atau koreksi tetap tercatat dan bisa dilihat pemilik.

## 2. Sasaran, bukan sasaran, dan anti-sasaran

### Sasaran (versi 1)
- Karyawan bisa mencatat pesanan dengan mengetuk menu, dan total dihitung otomatis.
- Pembayaran dicatat beserta caranya: Tunai, QRIS, atau Transfer.
- Belanja bahan dan pengeluaran operasional harian dicatat.
- Buka kas (modal awal laci) dan tutup kas (hitung uang fisik) dilakukan setiap hari. Aplikasi menampilkan selisih antara uang yang seharusnya ada dan uang yang benar-benar ada.
- Pemilik bisa melihat ringkasan hari ini, rekap mingguan/bulanan, menu terlaris, perkiraan untung, daftar pembatalan, dan riwayat selisih kas.
- Pemilik bisa mengelola menu dan harga, serta akun karyawan.

### Bukan sasaran (tidak dibuat di versi 1)
- Stok bahan baku per item (misalnya jumlah ekor lele). Belanja bahan cukup dicatat sebagai pengeluaran.
- Cetak struk atau printer Bluetooth.
- Banyak cabang. Desain hanya untuk satu warung, tetapi struktur datanya tidak menutup kemungkinan cabang ditambahkan nanti.
- Absensi atau gaji karyawan.
- Mode offline. Sinyal di warung stabil, jadi aplikasi boleh membutuhkan internet.
- Pemesanan oleh pembeli sendiri atau ojek online.

### Anti-sasaran (dianggap gagal walaupun aplikasinya berjalan)
- Mencatat pesanan terasa lebih lambat atau lebih repot daripada menulis di buku saat warung ramai.
- Karyawan bisa menghapus atau mengubah transaksi tanpa jejak yang terlihat oleh pemilik.
- Pemilik melihat angka yang tidak sesuai dengan uang di laci, tanpa tahu bahwa angkanya tidak sesuai.

## 3. Batasan

- **Perangkat:** HP Android pribadi karyawan dan pemilik, termasuk HP kelas bawah. Layar kecil dan sentuhan jempol.
- **Internet:** stabil di warung.
- **Bahasa antarmuka:** Bahasa Indonesia, dengan istilah sehari-hari dan tanpa istilah akuntansi yang rumit.
- **Mata uang:** Rupiah, bilangan bulat tanpa desimal, ditampilkan dengan format `Rp 15.000`.
- **Zona waktu:** Asia/Jakarta (WIB). "Hari" dihitung sesuai tanggal WIB.
- **Biaya:** sebisa mungkin gratis, yaitu Firebase paket gratis (Spark) dan Vercel paket gratis (Hobby).
- **Terpisah dari SiOps:** aplikasi, project Firebase, dan project Vercel semuanya baru. Tidak ada yang dipakai bersama dengan SiOps.

## 4. Pendekatan yang dipertimbangkan

| # | Pendekatan | Kelebihan | Kekurangan |
|---|---|---|---|
| 1 | **Aplikasi web (React) + Firebase, di-hosting di Vercel** | Satu link untuk semua; pembaruan langsung sampai ke semua HP; biaya hampir nol; aturan keamanan dijaga di server | Membutuhkan internet |
| 2 | APK Android mandiri (kode tertanam di APK) | Terasa seperti aplikasi asli | Setiap pembaruan harus instal ulang APK di setiap HP |
| 3 | Google Sheets / AppSheet | Paling cepat jadi | Karyawan bisa mengubah/menghapus isi sheet, sehingga bertentangan dengan tujuan "angka bisa dipercaya" |

**Pilihan pemilik:** pendekatan 1, ditambah aplikasi Android seperti SiOps (Capacitor). Aplikasi Android ini memuat aplikasi web dari Vercel, sehingga perubahan yang di-deploy ke Vercel langsung muncul di aplikasi Android tanpa instal ulang. Ini menggabungkan kelebihan 1 dan 2. APK hanya perlu dibangun ulang kalau ada perubahan di bagian Android itu sendiri (ikon, nama aplikasi, izin), dan hal itu jarang terjadi.

## 5. Keputusan "bagaimana"

### Diputuskan bersama pemilik
- Aplikasi web React + Firebase, di-deploy ke Vercel.
- Pembungkus Android dengan Capacitor (seperti SiOps). `server.url` diarahkan ke alamat Vercel supaya pembaruan otomatis.
- Dipakai di HP Android pribadi karyawan.
- Data yang tersimpan tidak bisa dihapus diam-diam. Pembatalan dan koreksi tetap tercatat dan terlihat oleh pemilik.

### Keputusan pembuat (pemilik bisa mengoreksi)
- **Teknologi:** sama seperti SiOps (React 19, Vite, TypeScript, Tailwind 4, Firebase JS SDK, Capacitor 8, ikon lucide-react) supaya mudah dirawat bersama. Tidak memakai Gemini/AI.
- **Lokasi kode:** folder `warung/` di repo ini, sebagai project mandiri dengan `package.json` sendiri, sampai pemilik membuat repo GitHub baru. Kodenya bisa dipindahkan utuh nanti. Project Vercel diarahkan ke root `warung/`.
- **Login:** pakai nama pengguna dan kata sandi, bukan login Google. Alasannya, login Google tidak berjalan di dalam WebView aplikasi Android. Secara teknis, Firebase Auth email/password dipakai dengan email buatan `<username>@warung.app`. Pemilik membuat akun karyawan dari aplikasi. Login tetap tersimpan di HP, jadi karyawan tidak perlu login ulang setiap hari.
- **Peran:** `pemilik` dan `karyawan`. Peran disimpan di koleksi `users` dan diperiksa oleh Firestore Security Rules. Akun pemilik pertama dibuat sekali secara manual saat penyiapan (lihat bagian 9).

## 6. Fitur

### 6.1 Karyawan

**Buka kas (awal hari)**
- Saat pertama dibuka pada hari itu, aplikasi meminta "Modal awal di laci" (Rp). Pesanan bisa dicatat setelah buka kas.
- Hanya ada satu sesi kas yang terbuka dalam satu waktu untuk seluruh warung, bukan per karyawan. Semua karyawan yang bertugas mencatat ke sesi yang sama.

**Catat pesanan**
- Menu tampil sebagai tombol besar berisi nama dan harga, dikelompokkan per kategori (Makanan, Nasi & Tambahan, Minuman). Satu ketuk menambah 1 porsi, dan ada tombol − / + untuk mengubah jumlah.
- Label pesanan opsional, misalnya nomor meja, nama pembeli, atau "bungkus".
- Catatan per pesanan opsional, misalnya "sambal pisah".
- Total dihitung otomatis.
- Pesanan disimpan dengan salah satu status berikut (lihat pertanyaan terbuka di bagian 10):
  - **Lunas**, dengan pilihan cara bayar Tunai / QRIS / Transfer. Untuk tunai, ada kolom "uang diterima" opsional yang menampilkan kembalian.
  - **Belum bayar**, untuk pembeli yang makan dulu lalu bayar. Pesanan ini muncul di daftar "Belum bayar" dan bisa ditandai lunas nanti.
- Pesanan yang sudah tersimpan **tidak bisa diedit**. Kalau salah, pesanan **dibatalkan dengan alasan wajib**, lalu dibuat pesanan baru. Pesanan yang dibatalkan tetap ada dan tidak dihitung dalam penjualan.

**Daftar pesanan hari ini**
- Daftar pesanan dalam sesi kas saat ini, dengan status (Belum bayar / Lunas / Batal), total, cara bayar, dan siapa yang mencatat.

**Catat pengeluaran**
- Kategori: Bahan baku (lele, ayam, sayur, bumbu), Minyak, Gas, Beras, Kemasan, Operasional lain.
- Isian: nominal, keterangan singkat, dan sumber uang (**dari laci** atau **bukan dari laci**, misalnya dibayar langsung oleh pemilik).
- Pengeluaran juga tidak bisa diedit, hanya dibatalkan dengan alasan.

**Tutup kas (akhir hari)**
- Aplikasi menampilkan **uang tunai yang seharusnya ada** = modal awal + penjualan tunai lunas − pengeluaran tunai dari laci.
- Karyawan memasukkan **uang fisik yang dihitung**.
- Aplikasi menampilkan **selisih**. Kalau selisihnya bukan nol, catatan wajib diisi.
- Kalau masih ada pesanan "Belum bayar", tutup kas tidak bisa dilakukan sampai pesanan itu dilunasi atau dibatalkan.
- Setelah tutup kas, sesi terkunci. Pencatatan berikutnya masuk ke sesi baru (buka kas lagi).

### 6.2 Pemilik
Semua yang bisa dilihat karyawan, ditambah:

- **Beranda hari ini:** total penjualan (per cara bayar), jumlah pesanan, total pengeluaran, perkiraan laba kotor (penjualan − pengeluaran), status kas (buka/tutup), dan pesanan belum bayar.
- **Rekap periode:** pilihan Hari / Minggu / Bulan / rentang tanggal. Isinya penjualan, pengeluaran per kategori, perkiraan laba, grafik penjualan harian, dan menu terlaris (jumlah porsi & rupiah).
- **Riwayat kas:** setiap sesi kas dengan modal awal, seharusnya, dihitung, selisih, catatan, dan siapa yang membuka/menutup. Selisih ditandai dengan warna.
- **Pembatalan:** daftar semua pesanan dan pengeluaran yang dibatalkan, dengan alasan, waktu, dan pelakunya.
- **Kelola menu:** tambah/ubah nama, harga, kategori, serta aktif/nonaktif. Menu tidak dihapus, hanya dinonaktifkan. Perubahan harga tidak mengubah pesanan lama karena harga disalin ke setiap pesanan saat dicatat.
- **Kelola karyawan:** buat akun (nama, username, kata sandi), nonaktifkan akun, dan reset kata sandi.
- **Ekspor:** unduh rekap periode sebagai CSV untuk dibuka di Excel/Sheets.

## 7. Data (Firestore)

Semua nominal disimpan dalam rupiah bilangan bulat. Semua waktu memakai `serverTimestamp()`, dengan field tanggal WIB `YYYY-MM-DD` untuk keperluan query.

- `users/{uid}`: `nama`, `username`, `peran` (`pemilik`|`karyawan`), `aktif`
- `menu/{id}`: `nama`, `harga`, `kategori`, `aktif`, `urutan`
- `sesiKas/{id}`: `tanggal`, `dibukaOleh`, `dibukaPada`, `modalAwal`, `status` (`buka`|`tutup`), `ditutupOleh`, `ditutupPada`, `seharusnya`, `dihitung`, `selisih`, `catatan`
- `pesanan/{id}`: `sesiKasId`, `tanggal`, `label`, `catatan`, `item[]` (`menuId`, `nama`, `harga`, `jumlah`), `total`, `status` (`belum_bayar`|`lunas`|`batal`), `caraBayar`, `uangDiterima`, `dibuatOleh`, `dibuatPada`, `dilunasiOleh`, `dilunasiPada`, `dibatalkanOleh`, `dibatalkanPada`, `alasanBatal`
- `pengeluaran/{id}`: `sesiKasId`, `tanggal`, `kategori`, `keterangan`, `nominal`, `dariLaci` (bool), `status` (`aktif`|`batal`), `dibuatOleh`, `dibuatPada`, `dibatalkanOleh`, `dibatalkanPada`, `alasanBatal`

Nama pengguna (`dibuatOleh`, dan sebagainya) disalin bersama uid supaya laporan tetap terbaca walaupun akun dinonaktifkan.

## 8. Aturan keamanan (inti "angka bisa dipercaya")

Aturan ini dijaga oleh **Firestore Security Rules di server**, bukan hanya disembunyikan di tampilan:

- Tidak ada yang bisa **menghapus** dokumen `pesanan`, `pengeluaran`, atau `sesiKas`, termasuk pemilik.
- Karyawan aktif boleh **membuat** pesanan/pengeluaran hanya di sesi kas yang sedang `buka`, dan `dibuatOleh` harus akun dirinya sendiri.
- Perubahan pesanan yang diizinkan hanya transisi status `belum_bayar → lunas` dan `belum_bayar|lunas → batal` (dengan alasan wajib). Field lain (item, total, harga) tidak boleh berubah setelah dibuat.
- `total` harus sama dengan jumlah `harga × jumlah` dari item. Ini divalidasi di rules sejauh memungkinkan, dan di aplikasi.
- Sesi kas yang sudah `tutup` tidak bisa diubah lagi.
- Hanya pemilik yang bisa menulis `menu` dan `users`.
- Akun yang `aktif = false` tidak bisa membaca atau menulis apa pun.

## 9. Penyiapan dan pengiriman

1. Buat project Firebase baru (Auth email/password + Firestore, region `asia-southeast2` Jakarta).
2. Buat project Vercel dari repo ini dengan root `warung/`. Konfigurasi Firebase dimasukkan lewat environment variable Vercel (`VITE_FIREBASE_*`).
3. Buat akun pemilik pertama lewat skrip satu kali atau manual di Firebase Console, lalu set `peran: pemilik`.
4. Isi menu awal (pemilik bisa mengubahnya di aplikasi).
5. Bangun APK Capacitor dengan `server.url` = alamat Vercel. APK dibagikan ke karyawan untuk diinstal (sideload).

Langkah yang membutuhkan akun pemilik (Firebase, Vercel) dikerjakan oleh pemilik dengan panduan langkah demi langkah dari pembuat.

## 10. Diserahkan kepada pembuat
- Struktur folder, komponen, dan penamaan kode.
- Detail tampilan: warna, tata letak, dan ikon. Patokannya: tombol besar, kontras tinggi, dan nyaman di layar kecil.
- Library grafik untuk rekap.
- Strategi pengujian, termasuk pengujian Security Rules dengan Firebase Emulator.
- Cara membuat akun karyawan dari sisi klien tanpa server (misalnya instance Firebase App kedua) atau dengan fungsi server kecil di Vercel.
