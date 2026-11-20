import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type Auth } from 'firebase/auth';
import { doc, onSnapshot, type Firestore, type Unsubscribe } from 'firebase/firestore';
import type { Pengguna } from '../types';

const SALAH = 'Username atau kata sandi salah.';
const KODE_SALAH = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'];

export function emailDariUsername(u: string): string {
  return `${u}@warung.app`;
}

export function usernameValid(u: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(u);
}

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

/**
 * Reports the signed-in user's profile (or null). Signs out when the profile is missing,
 * inactive, or unreadable (rules deny reads for inactive users).
 */
export function pantauPengguna(auth: Auth, db: Firestore, cb: (p: Pengguna | null) => void): Unsubscribe {
  let unsubDoc: Unsubscribe | null = null;
  const hentikanDoc = () => {
    unsubDoc?.();
    unsubDoc = null;
  };
  const tolak = () => {
    hentikanDoc();
    void signOut(auth).catch(() => {});
    cb(null);
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
        if (!snap.exists() || !d || d.aktif !== true) {
          tolak();
          return;
        }
        cb({ uid: user.uid, nama: d.nama, username: d.username, peran: d.peran, aktif: d.aktif });
      },
      () => tolak(),
    );
  });
  return () => {
    hentikanDoc();
    unsubAuth();
  };
}
