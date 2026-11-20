# Warung — Catatan Kas Warung

Aplikasi kasir dan catatan uang untuk warung: catat pesanan, terima bayar tunai atau QRIS, catat pengeluaran, tutup kas tiap shift, dan cetak struk ke printer Bluetooth.

Panduan ini untuk **pemilik warung**. Ikuti langkahnya satu per satu. Semua layanan yang dipakai **gratis** (Firebase paket Spark, Vercel paket Hobby).

> **Penting soal rahasia.** Beberapa langkah menghasilkan "kunci" (file JSON akun layanan). Kunci itu seperti kunci brankas: jangan dikirim lewat WhatsApp, jangan diunggah ke GitHub, jangan ditaruh di folder yang dibagikan. Contoh di panduan ini hanya contoh, bukan nilai asli.

Yang perlu disiapkan:

- Akun Google (untuk Firebase).
- Akun GitHub yang berisi kode ini, dan akun Vercel (bisa daftar pakai akun GitHub).
- Komputer dengan [Node.js](https://nodejs.org) versi 22 (untuk langkah 2 dan 5).
- HP Android untuk kasir, dan printer struk Bluetooth 58 mm (kalau mau cetak struk).

---

## 1. Buat proyek Firebase

Firebase adalah tempat menyimpan data warung (pesanan, kas, pengeluaran) dan akun login.

1. Buka <https://console.firebase.google.com> → **Tambahkan proyek** (Add project). Beri nama, misalnya `warung-bu-sri`. Google Analytics boleh dimatikan.
2. **Login pakai username dan kata sandi**
   Menu kiri **Build → Authentication** → **Mulai** → tab **Sign-in method** → pilih **Email/Password** → nyalakan yang pertama (Email/Password) → **Simpan**.
   (Aplikasi memakai username; di belakang layar username diubah jadi email `username@warung.app`. Tidak ada login Google.)
3. **Database**
   Menu kiri **Build → Firestore Database** → **Buat database** → pilih lokasi **`asia-southeast2` (Jakarta)** → mode **production** → **Buat**.
   Lokasi tidak bisa diubah setelah dibuat, jadi pastikan pilih Jakarta.
4. **Ambil pengaturan aplikasi web**
   Klik ikon gerigi ⚙ di samping "Project Overview" → **Setelan project** → bagian **Aplikasi Anda** → klik ikon **`</>`** (Web) → beri nama `warung` → **Daftarkan aplikasi**.
   Akan muncul kode berisi `firebaseConfig`. Salin enam nilai ini ke catatan, nanti dipakai di langkah 4:

   | Di `firebaseConfig` | Nama pengaturan di Vercel |
   |---|---|
   | `apiKey` | `VITE_FIREBASE_API_KEY` |
   | `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
   | `projectId` | `VITE_FIREBASE_PROJECT_ID` |
   | `storageBucket` | `VITE_FIREBASE_STORAGE_BUCKET` |
   | `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
   | `appId` | `VITE_FIREBASE_APP_ID` |

   Nilai-nilai ini memang boleh terlihat di aplikasi web (bukan rahasia). Keamanan data dijaga oleh aturan di langkah 2.

## 2. Pasang aturan keamanan database

Aturan ini memastikan karyawan hanya bisa melakukan yang boleh, dan data pesanan, pengeluaran, dan kas tidak bisa dihapus.

Di komputer, buka terminal (Command Prompt / PowerShell di Windows, Terminal di Mac) di folder `warung`, lalu jalankan:

```bash
npm install
npx firebase login
npx firebase deploy --only firestore:rules --project ID_PROYEK_ANDA
```

- `ID_PROYEK_ANDA` = nilai `projectId` dari langkah 1.4 (contoh: `warung-bu-sri`).
- `firebase login` akan membuka browser untuk masuk dengan akun Google yang sama.
- Berhasil kalau muncul tulisan **Deploy complete!**

Ulangi perintah terakhir setiap kali file `firestore.rules` diperbarui.

## 3. Buat kunci akun layanan (rahasia)

Kunci ini dipakai server untuk membuat akun karyawan dan akun pemilik.

1. Firebase → ⚙ **Setelan project** → tab **Akun layanan** (Service accounts).
2. Klik **Buat kunci pribadi baru** (Generate new private key) → **Buat kunci**.
3. Sebuah file `.json` terunduh. Ganti namanya jadi `kunci.json` dan simpan di tempat aman di komputer Anda (jangan di dalam folder yang diunggah ke GitHub).

Isi file inilah yang nanti diisi sebagai `FIREBASE_SERVICE_ACCOUNT`. Kalau kunci ini pernah bocor, hapus kuncinya di halaman yang sama lalu buat yang baru.

## 4. Pasang aplikasi di Vercel

Vercel adalah tempat aplikasi web warung berjalan, dan memberi alamatnya (misalnya `https://warung-bu-sri.vercel.app`).

1. Buka <https://vercel.com/new> → pilih repositori GitHub yang berisi kode ini → **Import**.
2. **Root Directory**: klik **Edit** → pilih folder **`warung`**. Framework akan terdeteksi sebagai **Vite** (biarkan).
3. Buka **Environment Variables**, isi satu per satu:

   | Name | Value (diisi dari mana) |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | `apiKey` dari langkah 1.4 |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` dari langkah 1.4 |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` dari langkah 1.4 |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` dari langkah 1.4 |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` dari langkah 1.4 |
   | `VITE_FIREBASE_APP_ID` | `appId` dari langkah 1.4 |
   | `FIREBASE_SERVICE_ACCOUNT` | **Seluruh isi** file `kunci.json` dari langkah 3 (buka dengan Notepad, salin semua dari `{` sampai `}`, tempel) |

4. Klik **Deploy**. Tunggu sampai selesai.
5. Catat alamat aplikasinya: di dashboard proyek Vercel, bagian **Domains** (contoh `https://warung-bu-sri.vercel.app`). Alamat ini disebut **WARUNG_URL** di langkah 7.

Kalau nanti mengubah Environment Variables, buka tab **Deployments** → titik tiga di deployment terakhir → **Redeploy** supaya perubahan dipakai.

## 5. Buat akun pemilik

Akun pemilik hanya dibuat sekali, dari komputer. Di folder `warung` jalankan (ganti `pemilik`, `sandiRahasia`, dan `Bu Sri` dengan milik Anda; username huruf kecil/angka/_ , 3–20 karakter; kata sandi minimal 6 karakter):

**Mac / Linux:**

```bash
FIREBASE_SERVICE_ACCOUNT="$(cat /lokasi/kunci.json)" npx tsx scripts/buat-pemilik.ts pemilik sandiRahasia "Bu Sri"
```

**Windows (PowerShell):**

```powershell
$env:FIREBASE_SERVICE_ACCOUNT = Get-Content -Raw C:\lokasi\kunci.json
npx tsx scripts/buat-pemilik.ts pemilik sandiRahasia "Bu Sri"
```

Berhasil kalau muncul: `Akun pemilik "pemilik" (Bu Sri) berhasil dibuat.`

## 6. Masuk dan isi data warung

Buka WARUNG_URL di browser HP atau komputer, lalu masuk dengan username dan kata sandi pemilik.

1. **Lainnya → Pengaturan**: isi nama warung (tampil di struk). Untuk QRIS, unggah foto QRIS statis warung (dari aplikasi bank / penyedia QRIS) atau tempel kodenya, lalu simpan. Aplikasi akan membuat QRIS dengan nominal otomatis untuk setiap pesanan.
2. **Lainnya → Kelola Menu**: tambahkan semua menu beserta harga dan kategorinya.
3. **Lainnya → Karyawan**: buat akun untuk tiap karyawan (username + kata sandi). Berikan username dan kata sandinya ke karyawan. Karyawan yang berhenti cukup dinonaktifkan; dia tidak bisa masuk lagi.

## 7. Buat aplikasi Android (APK) dan kirim ke karyawan

Aplikasi Android ini hanya "jendela" yang membuka WARUNG_URL, ditambah kemampuan mencetak ke printer Bluetooth. Jadi menu, harga, dan data selalu sama dengan versi web. APK hanya perlu dibuat ulang kalau WARUNG_URL berubah.

### Cara mudah: lewat GitHub (tanpa Android Studio)

1. Di GitHub, buka repositori ini → **Settings** → **Secrets and variables** → **Actions** → tab **Variables** → **New repository variable**.
   Name: `WARUNG_URL`, Value: alamat dari langkah 4.5 (contoh `https://warung-bu-sri.vercel.app`) → **Add variable**.
2. Buka tab **Actions** → pilih **Build APK Warung** di kiri → tombol **Run workflow** → **Run workflow**.
3. Tunggu sekitar 5–10 menit sampai tanda centang hijau. Klik hasil jalannya → bagian **Artifacts** → unduh **warung-apk** (file zip). Di dalamnya ada `app-debug.apk`.

### Cara lain: dengan Android Studio di komputer

Butuh [Android Studio](https://developer.android.com/studio). Di folder `warung`:

```bash
npm install
npm run build
WARUNG_URL=https://warung-bu-sri.vercel.app npx cap sync android
```

(Windows PowerShell: `$env:WARUNG_URL = "https://warung-bu-sri.vercel.app"` lalu `npx cap sync android`.)

Lalu buka folder `warung/android` di Android Studio → menu **Build → Build App Bundle(s) / APK(s) → Build APK(s)**. Setelah selesai, klik **locate**; file ada di `android/app/build/outputs/apk/debug/app-debug.apk`.

### Pasang di HP karyawan

Kirim file `app-debug.apk` ke HP karyawan (misalnya lewat WhatsApp atau kabel data). Ketuk filenya, izinkan **Instal dari sumber tidak dikenal** bila diminta, lalu **Instal**. Aplikasi muncul dengan nama **Warung**.

## 8. Sambungkan printer struk

1. Nyalakan printer Bluetooth 58 mm.
2. Di HP: **Pengaturan → Bluetooth** → nyalakan → pilih printer di daftar perangkat → pasangkan. Kalau diminta PIN, biasanya `0000` atau `1234` (lihat buku petunjuk printer).
3. Buka aplikasi **Warung** → ketuk ikon **gerigi ⚙** di kanan atas → **Printer Struk**. Izinkan akses Bluetooth bila diminta.
4. Pilih printer Anda di daftar, lalu ketuk **Cetak tes**. Kalau struk tes keluar, printer siap.
5. Kalau ingin struk langsung tercetak setiap pesanan lunas, nyalakan **Cetak struk otomatis**.

Setiap HP perlu memilih printernya sendiri sekali. Struk bisa juga dicetak dari menu **Pesanan → Lunas → Cetak struk**. Struk yang dicetak lagi akan bertuliskan **SALINAN**.
Di browser biasa (bukan aplikasi Android), Bluetooth tidak bisa dipakai; struk dicetak lewat jendela cetak browser.

---

## Kalau ada masalah

| Masalah | Coba ini |
|---|---|
| "Printer tidak tersambung. Cek Bluetooth dan printer." | Pastikan printer menyala, kertas ada, Bluetooth HP menyala, dan printer sudah dipasangkan di Pengaturan Bluetooth HP. Pesanan tetap tersimpan walau struk gagal dicetak; cetak lagi dari menu Pesanan. |
| Printer tidak muncul di daftar | Pasangkan dulu di Pengaturan Bluetooth HP, lalu ketuk **Cari printer lagi**. |
| Tidak bisa membuat akun karyawan | Periksa `FIREBASE_SERVICE_ACCOUNT` di Vercel (harus seluruh isi file kunci), lalu Redeploy. |
| Aplikasi Android tidak membuka apa-apa | WARUNG_URL salah atau belum diisi saat membuat APK. Perbaiki lalu buat APK lagi (langkah 7). |

## Untuk pengembang

```bash
npm install
npm run dev        # server pengembangan di port 3000
npm test           # tes unit dan tampilan
npm run test:emu   # tes aturan dan data dengan Firebase Emulator
npm run lint
npm run build
```

Konfigurasi lokal: salin `.env.example` ke `.env` dan isi nilainya (jangan di-commit). Bluetooth memakai plugin `@ascentio-it/capacitor-bluetooth-serial` (Bluetooth Classic / SPP); alasan pemilihannya ada di `src/printer/printer.ts`.
