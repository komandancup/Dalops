// Seeds the Auth + Firestore emulators (project demo-warung) for the end-to-end test.
// Run inside `firebase emulators:exec`, e.g. via `npm run e2e`.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { crc16 } from '../src/lib/qris';
import { emailDariUsername } from '../src/lib/username';
import type { Menu, Pengaturan, Peran, SesiAktif } from '../src/types';

process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.METADATA_SERVER_DETECTION ??= 'none'; // no GCP metadata probe (and its warning) outside Google Cloud

const tlv = (tag: string, value: string) => tag + String(value.length).padStart(2, '0') + value;

/** A valid static QRIS (same fixture as tests/lib/qris.test.ts), CRC included. */
function qrisStatis(): string {
  const akun = tlv('00', 'ID.CO.QRIS.WWW') + tlv('02', 'ID1234567890123');
  const badan = [
    tlv('00', '01'), tlv('01', '11'), tlv('26', akun), tlv('52', '5812'), tlv('53', '360'),
    tlv('58', 'ID'), tlv('59', 'WARUNG LELE 1'), tlv('60', 'JAKARTA'),
  ].join('') + '6304';
  return badan + crc16(badan);
}

const MENU: Omit<Menu, 'id'>[] = [
  { nama: 'Pecel Lele', harga: 15000, kategori: 'Makanan', aktif: true, urutan: 1 },
  { nama: 'Ayam Penyet', harga: 18000, kategori: 'Makanan', aktif: true, urutan: 2 },
  { nama: 'Nasi Putih', harga: 5000, kategori: 'Nasi & Tambahan', aktif: true, urutan: 3 },
  { nama: 'Tahu/Tempe', harga: 2000, kategori: 'Nasi & Tambahan', aktif: true, urutan: 4 },
  { nama: 'Es Teh', harga: 4000, kategori: 'Minuman', aktif: true, urutan: 5 },
  { nama: 'Teh Hangat', harga: 3000, kategori: 'Minuman', aktif: true, urutan: 6 },
  { nama: 'Es Jeruk', harga: 6000, kategori: 'Minuman', aktif: true, urutan: 7 },
];

const AKUN: { username: string; nama: string; peran: Peran }[] = [
  { username: 'pemilik', nama: 'Pak Pemilik', peran: 'pemilik' },
  { username: 'budi', nama: 'Budi', peran: 'karyawan' },
];

async function main() {
  initializeApp({ projectId: 'demo-warung' });
  const auth = getAuth();
  const db = getFirestore();

  for (const a of AKUN) {
    const { uid } = await auth.createUser({ email: emailDariUsername(a.username), password: 'rahasia1' });
    await db.doc(`users/${uid}`).set({ nama: a.nama, username: a.username, peran: a.peran, aktif: true });
  }
  const sesiAktif: SesiAktif = { sesiKasId: null, ditinggalTerakhir: 0 };
  await db.doc('pengaturan/sesiAktif').set(sesiAktif);
  const warung: Pengaturan = { namaWarung: 'Warung Pecel Lele', qrisStatis: qrisStatis(), namaMerchant: 'WARUNG LELE 1' };
  await db.doc('pengaturan/warung').set(warung);
  for (const m of MENU) await db.collection('menu').add(m);

  console.log('Emulator terisi: pemilik/budi (rahasia1), menu contoh, QRIS contoh.');
}

main().catch((e) => {
  console.error('Gagal mengisi emulator:', e);
  process.exit(1);
});
