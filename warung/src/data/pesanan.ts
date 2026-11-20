import {
  collection, doc, getDoc, increment, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where,
  type Firestore, type Unsubscribe,
} from 'firebase/firestore';
import { hitungTotal } from '../lib/kas';
import type { CaraBayar, ItemPesanan, Menu, Pelaku, Pesanan, SesiKas } from '../types';
import { dariDoc } from './konversi';

/** Cash change is only tracked for tunai; QRIS always stores null. */
function cekBayar(caraBayar: CaraBayar, uangDiterima: number | null, total: number | null): number | null {
  if (caraBayar === 'qris' || uangDiterima === null) return null;
  if (!Number.isInteger(uangDiterima)) throw new Error('Uang diterima harus angka bulat.');
  if (total !== null && uangDiterima < total) throw new Error('Uang diterima kurang dari total.');
  return uangDiterima;
}

/**
 * Creates an order with the next nomor of the session (transaction: create pesanan + bump jumlahPesanan).
 * Name and price are copied from the menu so later price changes never touch old orders.
 */
export async function buatPesanan(
  db: Firestore, pelaku: Pelaku, sesiId: string,
  keranjang: { menu: Menu; jumlah: number }[],
  opsi: { label: string; catatan: string; bayar: { caraBayar: CaraBayar; uangDiterima: number | null } | null },
): Promise<Pesanan> {
  if (keranjang.some((k) => !Number.isInteger(k.jumlah) || k.jumlah <= 0)) {
    throw new Error('Jumlah porsi harus angka bulat lebih dari 0.');
  }
  const item: ItemPesanan[] = keranjang.map((k) => ({ menuId: k.menu.id, nama: k.menu.nama, harga: k.menu.harga, jumlah: k.jumlah }));
  if (item.length === 0) throw new Error('Pesanan masih kosong.');
  const total = hitungTotal(item);
  const { bayar } = opsi;
  const uangDiterima = bayar ? cekBayar(bayar.caraBayar, bayar.uangDiterima, total) : null;

  const sesiRef = doc(db, 'sesiKas', sesiId);
  const ref = doc(collection(db, 'pesanan'));
  await runTransaction(db, async (tx) => {
    const sesiSnap = await tx.get(sesiRef);
    if (!sesiSnap.exists()) throw new Error('Sesi kas tidak ditemukan.');
    const sesi = sesiSnap.data() as SesiKas;
    if (sesi.status !== 'buka') throw new Error('Kas sudah ditutup. Buka kas dulu.');
    const nomor = sesi.jumlahPesanan + 1;
    tx.set(ref, {
      sesiKasId: sesiId, tanggal: sesi.tanggal, nomor, label: opsi.label, catatan: opsi.catatan,
      item, total, status: bayar ? 'lunas' : 'belum_bayar',
      caraBayar: bayar ? bayar.caraBayar : null, uangDiterima, jumlahCetak: 0,
      dibuatOleh: pelaku, dibuatPada: serverTimestamp(),
      dilunasiOleh: bayar ? pelaku : null, dilunasiPada: bayar ? serverTimestamp() : null,
      dibatalkanOleh: null, dibatalkanPada: null, alasanBatal: null,
    });
    tx.update(sesiRef, { jumlahPesanan: nomor });
  });
  return dariDoc<Pesanan>(await getDoc(ref));
}

export async function lunasiPesanan(
  db: Firestore, pelaku: Pelaku, id: string, caraBayar: CaraBayar, uangDiterima: number | null,
): Promise<void> {
  const ref = doc(db, 'pesanan', id);
  let total: number | null = null;
  if (caraBayar === 'tunai' && uangDiterima !== null) {
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Pesanan tidak ditemukan.');
    total = (snap.data() as Pesanan).total;
  }
  await updateDoc(ref, {
    status: 'lunas', caraBayar, uangDiterima: cekBayar(caraBayar, uangDiterima, total),
    dilunasiOleh: pelaku, dilunasiPada: serverTimestamp(),
  });
}

export async function batalkanPesanan(db: Firestore, pelaku: Pelaku, id: string, alasan: string): Promise<void> {
  const alasanBatal = alasan.trim();
  if (alasanBatal === '') throw new Error('Tulis alasan pembatalan.');
  await updateDoc(doc(db, 'pesanan', id), {
    status: 'batal', alasanBatal, dibatalkanOleh: pelaku, dibatalkanPada: serverTimestamp(),
  });
}

export async function catatCetak(db: Firestore, id: string): Promise<void> {
  await updateDoc(doc(db, 'pesanan', id), { jumlahCetak: increment(1) });
}

/** Orders of one session, sorted by nomor (sorted here to avoid needing a composite index). */
export function pantauPesananSesi(
  db: Firestore, sesiId: string, cb: (p: Pesanan[]) => void, onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(query(collection(db, 'pesanan'), where('sesiKasId', '==', sesiId)), (snap) => {
    cb(snap.docs.map((d) => dariDoc<Pesanan>(d)).sort((a, b) => a.nomor - b.nomor));
  }, onError);
}
