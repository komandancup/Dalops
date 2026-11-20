import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type Auth } from 'firebase/auth';
import { doc, onSnapshot, type Firestore, type Unsubscribe } from 'firebase/firestore';
import type { Pengguna } from '../types';
import { emailDariUsername, usernameValid } from '../lib/username';

const SALAH = 'Username atau kata sandi salah.';
const KODE_SALAH = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'];

export { emailDariUsername, usernameValid };

export async function masuk(auth: Auth, username: string, password: string): Promise<void> {
  const u = username.trim().toLowerCase();
  if (!usernameValid(u)) throw new Error(SALAH);
  try {
    await signInWithEmailAndPassword(auth, emailDariUsername(u), password);
  } catch (e) {
    const kode = (e as { code?: string }).code ?? '';
    if (KODE_SALAH.includes(kode)) throw new Error(SALAH);
    throw e;
  }
}

export function keluar(auth: Auth): Promise<void> {
  return signOut(auth);
}

export const ALASAN_NONAKTIF = 'Akun ini sudah dinonaktifkan. Hubungi pemilik.';
export const ALASAN_TIDAK_TERDAFTAR = 'Akun ini belum terdaftar di warung. Hubungi pemilik.';

/**
 * Reports the signed-in user's profile (or null). Signs out when the profile is missing,
 * inactive, or unreadable (rules deny reads for inactive users); then `cb` gets null plus
 * `{ alasan }` so the login screen can say why. Other listener errors go to `onError`
 * (the session is kept); without `onError` they are logged.
 */
export function pantauPengguna(
  auth: Auth, db: Firestore,
  cb: (p: Pengguna | null, info?: { alasan: string }) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  let unsubDoc: Unsubscribe | null = null;
  const hentikanDoc = () => {
    unsubDoc?.();
    unsubDoc = null;
  };
  const tolak = (alasan: string) => {
    hentikanDoc();
    void signOut(auth).catch(() => {});
    cb(null, { alasan });
  };
  const gagal = (err: unknown) => {
    if (onError) onError(err instanceof Error ? err : new Error(String((err as { message?: unknown })?.message ?? err)));
    else console.error('pantauPengguna:', err);
  };
  const unsubAuth = onAuthStateChanged(auth, (user) => {
    hentikanDoc();
    if (!user) {
      cb(null);
      return;
    }
    unsubDoc = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const d = snap.data() as Omit<Pengguna, 'uid'> | undefined;
        if (!snap.exists() || !d) {
          tolak(ALASAN_TIDAK_TERDAFTAR);
          return;
        }
        if (d.aktif !== true) {
          tolak(ALASAN_NONAKTIF);
          return;
        }
        cb({ uid: user.uid, nama: d.nama, username: d.username, peran: d.peran, aktif: d.aktif });
      },
      (err) => {
        if ((err as { code?: string }).code === 'permission-denied') tolak(ALASAN_NONAKTIF);
        else gagal(err);
      },
    );
  }, gagal);
  return () => {
    hentikanDoc();
    unsubAuth();
  };
}
