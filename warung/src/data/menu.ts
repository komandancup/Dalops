import { addDoc, collection, doc, onSnapshot, setDoc, type Firestore, type Unsubscribe } from 'firebase/firestore';
import type { Menu } from '../types';
import { dariDoc } from './konversi';

/** All menu items (active and inactive), sorted by `urutan`. */
export function pantauMenu(db: Firestore, cb: (menu: Menu[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(collection(db, 'menu'), (snap) => {
    cb(snap.docs.map((d) => dariDoc<Menu>(d)).sort((a, b) => a.urutan - b.urutan));
  }, onError);
}

/** Creates (no id) or overwrites (with id) a menu item. Menu is never deleted, only set `aktif: false`. */
export async function simpanMenu(db: Firestore, m: Omit<Menu, 'id'> & { id?: string }): Promise<void> {
  const data = { nama: m.nama.trim(), harga: m.harga, kategori: m.kategori, aktif: m.aktif, urutan: m.urutan };
  if (m.id) await setDoc(doc(db, 'menu', m.id), data);
  else await addDoc(collection(db, 'menu'), data);
}
