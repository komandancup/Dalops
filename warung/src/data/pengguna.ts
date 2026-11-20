import { collection, onSnapshot, type Firestore, type Unsubscribe } from 'firebase/firestore';
import type { Pengguna } from '../types';

/** Every account (pemilik and karyawan, active or not). Only the owner may read the whole collection. */
export function pantauSemuaPengguna(db: Firestore, cb: (p: Pengguna[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(collection(db, 'users'), (snap) => {
    cb(snap.docs.map((d) => ({ ...(d.data() as Omit<Pengguna, 'uid'>), uid: d.id }))
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id')));
  }, onError);
}
