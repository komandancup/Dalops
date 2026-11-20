import {
  addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where,
  type Firestore, type Unsubscribe,
} from 'firebase/firestore';
import { tanggalWIB } from '../lib/tanggal';
import type { KategoriPengeluaran, Pelaku, Pengeluaran } from '../types';
import { dariDoc } from './konversi';

/** Records an expense. `tanggal` follows the session, or today's WIB date for owner expenses outside a session. */
export async function catatPengeluaran(
  db: Firestore, pelaku: Pelaku,
  data: { sesiKasId: string | null; kategori: KategoriPengeluaran; keterangan: string; nominal: number; dariLaci: boolean },
): Promise<void> {
  let tanggal = tanggalWIB(new Date());
  if (data.sesiKasId !== null) {
    const sesi = await getDoc(doc(db, 'sesiKas', data.sesiKasId));
    if (!sesi.exists()) throw new Error('Sesi kas tidak ditemukan.');
    tanggal = sesi.data().tanggal as string;
  }
  await addDoc(collection(db, 'pengeluaran'), {
    sesiKasId: data.sesiKasId, tanggal, kategori: data.kategori, keterangan: data.keterangan.trim(),
    nominal: data.nominal, dariLaci: data.dariLaci, status: 'aktif',
    dibuatOleh: pelaku, dibuatPada: serverTimestamp(),
    dibatalkanOleh: null, dibatalkanPada: null, alasanBatal: null,
  });
}

export async function batalkanPengeluaran(db: Firestore, pelaku: Pelaku, id: string, alasan: string): Promise<void> {
  const alasanBatal = alasan.trim();
  if (alasanBatal === '') throw new Error('Tulis alasan pembatalan.');
  await updateDoc(doc(db, 'pengeluaran', id), {
    status: 'batal', alasanBatal, dibatalkanOleh: pelaku, dibatalkanPada: serverTimestamp(),
  });
}

/** Expenses of one session, newest first (sorted here to avoid needing a composite index). */
export function pantauPengeluaranSesi(
  db: Firestore, sesiId: string, cb: (e: Pengeluaran[]) => void, onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(query(collection(db, 'pengeluaran'), where('sesiKasId', '==', sesiId)), (snap) => {
    cb(snap.docs.map((d) => dariDoc<Pengeluaran>(d)).sort((a, b) => b.dibuatPada.getTime() - a.dibuatPada.getTime()));
  }, onError);
}
