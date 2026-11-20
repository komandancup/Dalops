// Usage: FIREBASE_SERVICE_ACCOUNT='{...json...}' npx tsx scripts/buat-pemilik.ts <username> <password> <nama>
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { emailDariUsername, usernameValid } from '../src/data/auth';

async function main() {
  const [usernameMentah, password, ...sisa] = process.argv.slice(2);
  const nama = sisa.join(' ').trim();
  const username = (usernameMentah ?? '').trim().toLowerCase();
  if (!username || !password || !nama) {
    console.error('Cara pakai: npx tsx scripts/buat-pemilik.ts <username> <password> <nama>');
    process.exit(1);
  }
  if (!usernameValid(username)) {
    console.error('Username hanya huruf kecil, angka, _ (3–20 karakter).');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Kata sandi minimal 6 karakter.');
    process.exit(1);
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('Isi dulu FIREBASE_SERVICE_ACCOUNT dengan JSON akun layanan Firebase.');
    process.exit(1);
  }
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = getFirestore();

  const { uid } = await getAuth().createUser({ email: emailDariUsername(username), password });
  await db.doc(`users/${uid}`).set({ nama, username, peran: 'pemilik', aktif: true });

  const ref = db.doc('pengaturan/sesiAktif');
  if (!(await ref.get()).exists) await ref.set({ sesiKasId: null, ditinggalTerakhir: 0 });

  console.log(`Akun pemilik "${username}" (${nama}) berhasil dibuat. Silakan masuk di aplikasi.`);
}

main().catch((e) => {
  const kode = (e as { code?: string }).code;
  console.error(kode === 'auth/email-already-exists' ? 'Username sudah dipakai.' : `Gagal membuat akun: ${(e as Error).message}`);
  process.exit(1);
});
