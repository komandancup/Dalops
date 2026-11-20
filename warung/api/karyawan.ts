import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { prosesKaryawan, type KaryawanDeps } from './_lib/karyawanHandler.js';
import type { Pengguna } from '../src/types.js';

// Vercel Node handler (types kept loose on purpose; no @vercel/node dependency).
interface Req { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
interface Res { status(code: number): Res; json(body: unknown): void }

function siapkanAdmin(): boolean {
  if (getApps().length > 0) return true;
  try {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '')) });
    return true;
  } catch {
    return false;
  }
}

const deps: KaryawanDeps = {
  verifikasiToken: (t) => getAuth().verifyIdToken(t),
  async ambilPengguna(uid) {
    const snap = await getFirestore().doc(`users/${uid}`).get();
    const d = snap.data();
    return snap.exists && d ? ({ uid, nama: d.nama, username: d.username, peran: d.peran, aktif: d.aktif } as Pengguna) : null;
  },
  async buatAkun(email, password) {
    return (await getAuth().createUser({ email, password })).uid;
  },
  async setPassword(uid, pw) {
    await getAuth().updateUser(uid, { password: pw });
  },
  async nonaktifkan(uid) {
    await getAuth().updateUser(uid, { disabled: true });
  },
  async hapusAkun(uid) {
    await getAuth().deleteUser(uid);
  },
  async simpanPengguna(p) {
    // Document id is the uid; stored fields match the exact key set in firestore.rules.
    await getFirestore().doc(`users/${p.uid}`).set({ nama: p.nama, username: p.username, peran: p.peran, aktif: p.aktif });
  },
};

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.status(400).json({ ok: false, pesan: 'Permintaan tidak valid.' });
    return;
  }
  if (!siapkanAdmin()) {
    res.status(500).json({ ok: false, pesan: 'Server belum dikonfigurasi (FIREBASE_SERVICE_ACCOUNT).' });
    return;
  }
  const h = req.headers.authorization;
  const auth = Array.isArray(h) ? h[0] : h;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  try {
    const hasil = await prosesKaryawan(req.body, token, deps);
    res.status(hasil.status).json(hasil.body);
  } catch {
    res.status(500).json({ ok: false, pesan: 'Terjadi kesalahan. Coba lagi.' });
  }
}
