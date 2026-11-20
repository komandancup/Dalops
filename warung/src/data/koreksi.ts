import { addDoc, collection, doc, getDoc, serverTimestamp, type Firestore } from 'firebase/firestore';
import type { Pelaku } from '../types';

/** Owner-only correction note on a (usually closed) session; dated with the session's tanggal. */
export async function tambahKoreksi(
  db: Firestore, pelaku: Pelaku, sesiId: string, nominal: number, catatan: string,
): Promise<void> {
  const teks = catatan.trim();
  if (teks === '') throw new Error('Tulis catatan koreksi.');
  const sesi = await getDoc(doc(db, 'sesiKas', sesiId));
  if (!sesi.exists()) throw new Error('Sesi kas tidak ditemukan.');
  await addDoc(collection(db, 'koreksi'), {
    sesiKasId: sesiId, tanggal: sesi.data().tanggal, nominal, catatan: teks,
    dibuatOleh: pelaku, dibuatPada: serverTimestamp(),
  });
}
