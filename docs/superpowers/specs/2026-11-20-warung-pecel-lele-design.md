# Desain: Aplikasi Pencatatan Warung Pecel Lele & Ayam Penyet

Tanggal: 2026-11-20
Status: Draf, menunggu persetujuan pemilik

## 1. Maksud dan alasan

Warung pecel lele & ayam penyet saat ini mencatat semuanya secara manual. Pesanan pembeli ditulis di buku, sedangkan belanja bahan dan pengeluaran tidak tercatat rapi. Akibatnya ada dua masalah:

- **Saat melayani:** pesanan dan total belanja sering keliru.
- **Saat akhir hari atau akhir bulan:** omzet, keuntungan, dan isi uang laci tidak jelas.

Pemilik adalah **investor** yang tidak setiap hari berada di warung. Sehari-hari warung dijalankan oleh **karyawan**. Aplikasi ini punya dua tujuan:

1. **Untuk karyawan:** pesanan, pembayaran (tunai atau QRIS), pengeluaran, dan tutup kas bisa dicatat dengan cepat dari HP Android pribadi. Prosesnya tidak boleh lebih lambat daripada menulis di buku.
2. **Untuk pemilik:** dari HP-nya sendiri, kapan saja, pemilik bisa melihat angka penjualan, pengeluaran, dan uang yang **bisa dipercaya**.

Inti desain ini adalah angka yang bisa dipercaya. Data yang sudah tersimpan tidak boleh hilang atau berubah diam-diam. Setiap pembatalan atau koreksi tetap tercatat dan terlihat oleh pemilik.

## 2. Sasaran, bukan sasaran, dan anti-sasaran

### Sasaran (versi 1)
- Karyawan mencatat pesanan dengan mengetuk menu, dan total dihitung otomatis.
- Pembayaran dicatat beserta caranya: **Tunai** atau **QRIS**.
- Untuk QRIS, aplikasi menampilkan **QR berisi nominal pesanan** (QRIS dinamis) sehingga pembeli tidak perlu mengetik nominal.
- Belanja bahan dan pengeluaran operasional dicatat.
- Setiap shift ada **buka kas** dan **tutup kas**. Saat tutup kas, uang tunai dihitung, jumlah QRIS dicocokkan, lalu dicatat berapa yang disetor ke pemilik dan berapa yang ditinggal di laci. Aplikasi menampilkan selisih dari setiap pencocokan.
- Pemilik melihat ringkasan hari ini, rekap mingguan/bulanan, menu terlaris, perkiraan untung, pembatalan, dan riwayat kas.
- Pemilik mengelola menu, harga, akun karyawan, dan QRIS warung.

### Bukan sasaran (tidak dibuat di versi 1)
- Stok bahan baku per item. Belanja bahan cukup dicatat sebagai pengeluaran.
- **Konfirmasi QRIS otomatis.** Untuk ini dibutuhkan payment gateway berbayar (Midtrans/Xendit). Di versi 1, karyawan menandai lunas secara manual setelah melihat notifikasi di aplikasi merchant QRIS.
- Pembayaran transfer bank.
- Kasbon (hutang pelanggan yang dibayar di hari lain).
- Cetak struk atau printer Bluetooth.
- Banyak cabang. Desain dibuat untuk satu warung, tetapi struktur data tidak menutup kemungkinan cabang di kemudian hari.
- Absensi atau gaji karyawan.
- Mode offline. Sinyal di warung stabil.
- Pemesanan oleh pembeli sendiri atau lewat ojek online.

### Anti-sasaran (dianggap gagal walaupun aplikasinya berjalan)
- Mencatat pesanan terasa lebih lambat atau repot daripada menulis di buku saat warung ramai.
- Karyawan bisa menghapus atau mengubah transaksi tanpa jejak yang terlihat oleh pemilik.
- Pemilik melihat angka yang tidak sesuai dengan uang yang sebenarnya, tanpa tahu bahwa angkanya tidak sesuai.

## 3. Batasan

- **Perangkat:** HP Android pribadi karyawan dan pemilik, termasuk HP kelas bawah, dipakai di layar kecil dengan jempol.
- **Internet:** stabil di warung.
- **Bahasa antarmuka:** Bahasa Indonesia sehari-hari, tanpa istilah akuntansi.
- **Mata uang:** Rupiah, bilangan bulat, ditampilkan dengan format `Rp 15.000`.
- **Zona waktu:** Asia/Jakarta (WIB).
- **Biaya:** sebisa mungkin gratis, yaitu Firebase paket Spark dan Vercel paket Hobby. Fitur QRIS dinamis tidak memakai layanan pihak ketiga.
- **Terpisah dari SiOps:** aplikasi, project Firebase, dan project Vercel semuanya dibuat baru.

## 4. Pendekatan yang dipertimbangkan

| # | Pendekatan | Kelebihan | Kekurangan |
|---|---|---|---|
| 1 | **Aplikasi web (React) + Firebase, di-hosting di Vercel** | Satu link untuk semua orang, pembaruan langsung sampai, biaya hampir nol, aturan keamanan dijaga di server | Membutuhkan internet |
| 2 | APK Android mandiri (kode tertanam di APK) | Terasa seperti aplikasi asli | Setiap pembaruan harus instal ulang APK di semua HP |
| 3 | Google Sheets / AppSheet | Paling cepat jadi | Isi sheet bisa diubah atau dihapus karyawan, bertentangan dengan tujuan "angka bisa dipercaya" |

**Pilihan pemilik:** pendekatan 1, ditambah aplikasi Android seperti SiOps (Capacitor). Aplikasi Android ini memuat aplikasi web dari Vercel, sehingga setiap perubahan yang di-deploy ke Vercel langsung muncul tanpa instal ulang. APK hanya perlu dibangun ulang kalau bagian Android-nya sendiri berubah, misalnya ikon, nama, atau izin.

## 5. Keputusan "bagaimana"

### Diputuskan bersama pemilik
- Aplikasi web React + Firebase, di-deploy ke Vercel. Pembungkus Android memakai Capacitor dengan `server.url` mengarah ke alamat Vercel.
- Dipakai di HP Android pribadi karyawan.
- Data yang sudah tersimpan tidak bisa dihapus diam-diam. Pembatalan dan koreksi tetap tercatat dan terlihat oleh pemilik.
- Cara bayar hanya **Tunai** dan **QRIS**.
- QRIS dinamis dibuat dengan cara yang sama seperti [verssache/qris-dinamis](https://github.com/verssache/qris-dinamis) (lisensi MIT): QRIS statis milik warung diubah menjadi QR bernominal.
- Ada status "Belum bayar" untuk pembeli yang makan dulu baru bayar. Semua pesanan harus lunas atau dibatalkan sebelum tutup kas. Tidak ada kasbon lintas hari.
- **Hari kerja dihitung per sesi kas**, dari buka kas sampai tutup kas. Pesanan pukul 00.30 tetap masuk ke sesi yang sedang berjalan. Jika ada pergantian shift, setiap shift membuka dan menutup kasnya sendiri.
- Saat tutup kas, karyawan mencatat **uang yang disetor** dan **uang yang ditinggal di laci**. Modal awal sesi berikutnya otomatis terisi dari uang yang ditinggal. Jika karyawan mengubah angka itu, aplikasi menandainya ke pemilik.
- Karyawan boleh membatalkan pesanan, termasuk yang sudah lunas, dengan alasan wajib. Setiap pembatalan **langsung muncul sebagai peringatan** di beranda pemilik. Pembatalan tidak memerlukan persetujuan pemilik.

### Keputusan pembuat (pemilik bisa mengoreksi)
- **Teknologi:** sama seperti SiOps, yaitu React 19, Vite, TypeScript, Tailwind 4, Firebase JS SDK, Capacitor 8, dan lucide-react. Tidak memakai AI.
- **Lokasi kode:** folder `warung/` di repo ini sebagai project mandiri dengan `package.json` sendiri, sampai pemilik membuat repo baru. Root project Vercel diarahkan ke `warung/`.
- **Login:** nama pengguna dan kata sandi, karena login Google tidak berjalan di WebView aplikasi Android. Di belakangnya dipakai Firebase Auth email/password dengan email buatan `<username>@warung.app`. Pemilik membuat akun karyawan dari aplikasi. Sesi login tetap tersimpan di HP.
- **Peran:** `pemilik` dan `karyawan`, disimpan di koleksi `users` dan diperiksa oleh Firestore Security Rules.
- **Pengeluaran oleh pemilik:** pemilik bisa mencatat pengeluaran kapan saja, tanpa sesi kas, misalnya belanja yang dibayar langsung. Pengeluaran ini dihitung dalam laba tetapi tidak memengaruhi hitungan uang laci.
- **Kas yang sudah ditutup** tidak bisa diubah. Jika ada kesalahan yang baru ketahuan belakangan, pemilik menambahkan **catatan koreksi** (berisi teks dan nominal penyesuaian, boleh nol). Catatan ini ditampilkan di samping sesi tersebut dan nominalnya ikut dihitung di rekap.
- **Kode QRIS dinamis** ditulis ulang sendiri, sekitar 50 baris TypeScript, dengan atribusi MIT. Library tersebut tidak dipasang sebagai dependency. Ada tambahan pengaman: jika QRIS tidak memiliki tag 58 atau nominal tidak valid, aplikasi menolak dan menampilkan pesan, bukan diam-diam menghasilkan QR tanpa nominal.

## 6. Fitur

### 6.1 Karyawan

**Buka kas**
- Pesanan baru bisa dicatat setelah ada sesi kas yang terbuka. Dalam satu waktu hanya boleh ada satu sesi terbuka untuk seluruh warung.
- "Modal awal di laci" otomatis terisi dari "uang ditinggal" sesi sebelumnya. Jika karyawan mengubahnya, alasan wajib diisi dan pemilik melihat tanda di riwayat kas.
- Jika sesi sebelumnya belum ditutup, karyawan diarahkan untuk menutupnya terlebih dahulu.

**Catat pesanan**
- Menu ditampilkan sebagai tombol besar berisi nama dan harga, dikelompokkan per kategori (Makanan, Nasi & Tambahan, Minuman). Satu ketukan menambah 1 porsi. Jumlah bisa diubah dengan tombol − / +.
- Label pesanan opsional, misalnya nomor meja, nama, atau "bungkus". Catatan opsional, misalnya "sambal pisah".
- Total dihitung otomatis. Pesanan bisa disimpan sebagai:
  - **Bayar sekarang:**
    - **Tunai:** kolom "uang diterima" opsional, kembalian ditampilkan.
    - **QRIS:** layar penuh menampilkan QR bernominal dan total dalam huruf besar. Setelah notifikasi di aplikasi merchant masuk, karyawan menekan **"Sudah masuk, tandai lunas"**. Tersedia juga tombol "Batal/ganti ke tunai".
  - **Belum bayar:** pesanan masuk ke daftar "Belum bayar" dan bisa dilunasi nanti dengan alur yang sama.
- Pesanan yang sudah tersimpan **tidak bisa diedit**. Jika salah, pesanan **dibatalkan dengan alasan wajib**, lalu dibuat pesanan baru.

**Daftar pesanan sesi ini**
- Menampilkan status (Belum bayar / Lunas / Batal), total, cara bayar, dan pencatat.

**Catat pengeluaran**
- Kategori: Bahan baku, Minyak, Gas, Beras, Kemasan, Operasional lain.
- Isian: nominal, keterangan, dan sumber uang (**dari laci** atau **bukan dari laci**).
- Pengeluaran tidak bisa diedit, hanya dibatalkan dengan alasan.

**Tutup kas**
- Semua pesanan "Belum bayar" harus lunas atau dibatalkan terlebih dahulu.
- **Tunai:**
  - Seharusnya = modal awal + penjualan tunai lunas − pengeluaran tunai dari laci.
  - Karyawan memasukkan uang fisik yang dihitung, lalu aplikasi menampilkan selisih tunai.
- **QRIS:**
  - Total QRIS lunas di aplikasi.
  - Karyawan memasukkan total uang masuk dari laporan aplikasi merchant QRIS untuk sesi ini, lalu aplikasi menampilkan selisih QRIS.
- Jika salah satu selisih bukan nol, catatan wajib diisi.
- **Setoran:** uang disetor ke pemilik + uang ditinggal di laci = uang fisik dihitung.
- Setelah ditutup, sesi terkunci.

### 6.2 Pemilik
Pemilik bisa melihat semua yang dilihat karyawan, ditambah:

- **Beranda:**
  - Penjualan hari ini, dipisah Tunai dan QRIS.
  - Jumlah pesanan, pengeluaran, dan perkiraan laba kotor.
  - Status kas dan pesanan belum bayar.
  - **Peringatan:** pembatalan, selisih kas, dan modal awal yang diubah.
- **Rekap periode** (hari / minggu / bulan / rentang tanggal): penjualan per cara bayar, pengeluaran per kategori, perkiraan laba, grafik harian, dan menu terlaris (dalam porsi dan rupiah). Pengelompokan per hari memakai tanggal WIB saat sesi dibuka.
- **Riwayat kas:** setiap sesi dengan modal awal, penjualan tunai/QRIS, uang seharusnya, uang dihitung, selisih, setoran, uang ditinggal, catatan koreksi, serta siapa yang membuka dan menutup.
- **Pembatalan:** semua pesanan dan pengeluaran yang dibatalkan, beserta alasan, waktu, dan pelakunya.
- **Kelola menu:** tambah/ubah nama, harga, kategori, dan status aktif. Menu tidak dihapus, hanya dinonaktifkan. Harga disalin ke setiap pesanan, sehingga perubahan harga tidak mengubah data lama.
- **Kelola karyawan:** buat akun, nonaktifkan akun, dan reset kata sandi.
- **Pengaturan QRIS:** unggah foto/scan QRIS statis warung atau tempel teksnya. Aplikasi memvalidasi CRC dan menampilkan nama merchant untuk dicek.
- **Pengeluaran pemilik** dan **catatan koreksi** (lihat bagian 5).
- **Ekspor CSV** rekap periode.

## 7. Data (Firestore)

Nominal disimpan dalam rupiah bilangan bulat. Waktu memakai `serverTimestamp()`. Field `tanggal` berisi tanggal WIB (`YYYY-MM-DD`) saat sesi dibuka.

- `users/{uid}`: `nama`, `username`, `peran` (`pemilik`|`karyawan`), `aktif`
- `pengaturan/warung`: `namaWarung`, `qrisStatis` (string), `namaMerchant`
- `menu/{id}`: `nama`, `harga`, `kategori`, `aktif`, `urutan`
- `sesiKas/{id}`: `tanggal`, `status` (`buka`|`tutup`), `dibukaOleh`, `dibukaPada`, `modalAwal`, `modalSaran`, `alasanUbahModal`, `ditutupOleh`, `ditutupPada`, `tunaiSeharusnya`, `tunaiDihitung`, `selisihTunai`, `qrisAplikasi`, `qrisMerchant`, `selisihQris`, `disetor`, `ditinggal`, `catatan`
- `pesanan/{id}`: `sesiKasId`, `tanggal`, `label`, `catatan`, `item[]` (`menuId`, `nama`, `harga`, `jumlah`), `total`, `status` (`belum_bayar`|`lunas`|`batal`), `caraBayar` (`tunai`|`qris`), `uangDiterima`, `dibuatOleh`, `dibuatPada`, `dilunasiOleh`, `dilunasiPada`, `dibatalkanOleh`, `dibatalkanPada`, `alasanBatal`
- `pengeluaran/{id}`: `sesiKasId` (kosong jika dicatat pemilik di luar sesi), `tanggal`, `kategori`, `keterangan`, `nominal`, `dariLaci`, `status` (`aktif`|`batal`), `dibuatOleh`, `dibuatPada`, `dibatalkanOleh`, `dibatalkanPada`, `alasanBatal`
- `koreksi/{id}`: `sesiKasId`, `tanggal`, `nominal`, `catatan`, `dibuatOleh`, `dibuatPada`

Nama pelaku disalin bersama uid, supaya laporan tetap terbaca walaupun akunnya dinonaktifkan.

## 8. Aturan keamanan (inti "angka bisa dipercaya")

Aturan berikut dijaga oleh **Firestore Security Rules di server**:

- Tidak ada yang bisa **menghapus** `pesanan`, `pengeluaran`, `sesiKas`, atau `koreksi`, termasuk pemilik.
- Karyawan aktif boleh **membuat** pesanan dan pengeluaran hanya di sesi yang berstatus `buka`, dan `dibuatOleh` harus berisi akunnya sendiri.
- Perubahan pesanan yang diizinkan hanya `belum_bayar → lunas` (dengan `caraBayar`) dan `belum_bayar|lunas → batal` (dengan alasan wajib). Item, total, dan harga tidak boleh berubah.
- `total` = jumlah dari `harga × jumlah` per item. Ini divalidasi di aplikasi, dan di rules sejauh memungkinkan.
- Sesi berstatus `tutup` tidak bisa diubah. Hanya boleh ada satu sesi berstatus `buka` (dijaga lewat dokumen penanda `pengaturan/sesiAktif`).
- Hanya pemilik yang bisa menulis `menu`, `users`, `pengaturan/warung`, `koreksi`, dan pengeluaran di luar sesi.
- Akun yang `aktif = false` tidak bisa membaca atau menulis apa pun.

## 9. Penyiapan dan pengiriman

1. Buat project Firebase baru (Auth email/password dan Firestore, region `asia-southeast2`).
2. Buat project Vercel dengan root `warung/`. Konfigurasi Firebase diisi lewat environment variable `VITE_FIREBASE_*`.
3. Buat akun pemilik pertama melalui skrip satu kali atau Firebase Console dengan `peran: pemilik`.
4. Pemilik login, mengisi QRIS statis warung, menu awal, dan akun karyawan.
5. Bangun APK Capacitor dengan `server.url` mengarah ke alamat Vercel, lalu bagikan ke karyawan (sideload).

Langkah yang membutuhkan akun pemilik (Firebase, Vercel) dikerjakan oleh pemilik dengan panduan langkah demi langkah.

## 10. Diserahkan kepada pembuat
- Struktur folder, komponen, dan penamaan kode.
- Detail tampilan, dengan patokan: tombol besar, kontras tinggi, dan nyaman di layar kecil.
- Library grafik dan library pembuat gambar QR.
- Strategi pengujian, termasuk pengujian Security Rules dengan Firebase Emulator dan uji konversi QRIS terhadap contoh dari repo qris-dinamis.
- Cara membuat akun karyawan tanpa server (instance Firebase App kedua) atau dengan fungsi kecil di Vercel.
