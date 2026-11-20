import {
  collection, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, where,
  type Firestore, type Unsubscribe,
} from 'firebase/firestore';
import { ringkasSesi, validasiTutup } from '../lib/kas';
import { tanggalWIB } from '../lib/tanggal';
import type { Koreksi, Pelaku, Pengeluaran, Pesanan, SesiAktif, SesiKas } from '../types';
import { dariDoc } from './konversi';

const sesiAktifRef = (db: Firestore) => doc(db, 'pengaturan', 'sesiAktif');
const sesiRef = (db: Firestore, id: string) => doc(db, 'sesiKas', id);

async function ambilSesi(db: Firestore, id: string): Promise<SesiKas> {
  const snap = await getDoc(sesiRef(db, id));
  if (!snap.exists()) throw new Error('Sesi kas tidak ditemukan.');
  return dariDoc<SesiKas>(snap);
}

export const GALAT_TANGGAL_HP = 'Tanggal di HP tidak sesuai. Atur tanggal & jam HP ke otomatis, lalu coba lagi.';

/**
 * Opens a cash session. If one is already open, returns it instead of opening another.
 * The rules only accept a `tanggal` equal to the server's WIB date (±10 min), so a phone with a wrong
 * date is refused; every other rule on this write is already checked here, hence the mapping below.
 */
export async function bukaSesi(
  db: Firestore, pelaku: Pelaku, modalAwal: number, alasanUbahModal: string | null,
): Promise<SesiKas> {
  const id = await runTransaction(db, async (tx) => {
    const penanda = (await tx.get(sesiAktifRef(db))).data() as SesiAktif | undefined;
    if (!penanda) throw new Error('Pengaturan kas belum disiapkan pemilik.');
    if (penanda.sesiKasId) return penanda.sesiKasId;

    const modalSaran = penanda.ditinggalTerakhir;
    const alasan = modalAwal === modalSaran ? null : (alasanUbahModal ?? '').trim();
    if (alasan === '') throw new Error('Modal awal berbeda dari saran. Tulis alasannya.');

    const ref = doc(collection(db, 'sesiKas'));
    tx.set(ref, {
      tanggal: tanggalWIB(new Date()), status: 'buka', jumlahPesanan: 0, pesananTerakhir: null,
      dibukaOleh: pelaku, dibukaPada: serverTimestamp(), modalAwal, modalSaran, alasanUbahModal: alasan,
      ditutupOleh: null, ditutupPada: null, tunaiSeharusnya: null, tunaiDihitung: null, selisihTunai: null,
      qrisAplikasi: null, qrisMerchant: null, selisihQris: null, disetor: null, ditinggal: null, catatan: null,
    });
    tx.update(sesiAktifRef(db), { sesiKasId: ref.id });
    return ref.id;
  }).catch((e: unknown) => {
    if ((e as { code?: unknown })?.code === 'permission-denied') throw new Error(GALAT_TANGGAL_HP);
    throw e;
  });
  return ambilSesi(db, id);
}

export async function ambilSesiAktif(db: Firestore): Promise<{ aktif: SesiKas | null; modalSaran: number }> {
  const penanda = (await getDoc(sesiAktifRef(db))).data() as SesiAktif | undefined;
  const modalSaran = penanda?.ditinggalTerakhir ?? 0;
  if (!penanda?.sesiKasId) return { aktif: null, modalSaran };
  return { aktif: await ambilSesi(db, penanda.sesiKasId), modalSaran };
}

/** Follows the open session (null when none). Re-subscribes when the marker moves. */
export function pantauSesiAktif(
  db: Firestore, cb: (s: SesiKas | null) => void, onError?: (e: Error) => void,
): Unsubscribe {
  let lepasSesi: Unsubscribe | null = null;
  let idSekarang: string | null | undefined; // undefined = no marker snapshot yet
  const lepasPenanda = onSnapshot(sesiAktifRef(db), (snap) => {
    const id = (snap.data() as SesiAktif | undefined)?.sesiKasId ?? null;
    if (id === idSekarang) return;
    lepasSesi?.();
    lepasSesi = null;
    idSekarang = id;
    if (!id) {
      cb(null);
      return;
    }
    lepasSesi = onSnapshot(sesiRef(db, id), (s) => cb(s.exists() ? dariDoc<SesiKas>(s) : null), onError);
  }, onError);
  return () => {
    lepasPenanda();
    lepasSesi?.();
  };
}

/** The order list queried before the transaction no longer matches the session counter. */
class PesananBerubah extends Error {
  constructor() {
    super('Ada pesanan baru masuk. Coba tutup kas lagi.');
  }
}

/**
 * Closes the session. Per ruling R1 the orders/expenses are queried first (web SDK transactions
 * cannot run queries); the transaction then re-reads sesi + sesiAktif and writes both.
 * If the queried orders turn out stale, they are queried once more before giving up.
 */
export async function tutupSesi(
  db: Firestore, pelaku: Pelaku, sesiId: string,
  data: { tunaiDihitung: number; qrisMerchant: number; disetor: number; ditinggal: number; catatan: string },
): Promise<void> {
  const ambilCatatan = async () => {
    const [pesananSnap, pengeluaranSnap] = await Promise.all([
      getDocs(query(collection(db, 'pesanan'), where('sesiKasId', '==', sesiId))),
      getDocs(query(collection(db, 'pengeluaran'), where('sesiKasId', '==', sesiId))),
    ]);
    return {
      pesanan: pesananSnap.docs.map((d) => dariDoc<Pesanan>(d)),
      pengeluaran: pengeluaranSnap.docs.map((d) => dariDoc<Pengeluaran>(d)),
    };
  };

  let catatanSesi = await ambilCatatan();
  for (let coba = 0; ; coba++) {
    try {
      await tulisTutup(db, pelaku, sesiId, data, catatanSesi.pesanan, catatanSesi.pengeluaran);
      return;
    } catch (e) {
      if (!(e instanceof PesananBerubah) || coba > 0) throw e;
      catatanSesi = await ambilCatatan();
    }
  }
}

async function tulisTutup(
  db: Firestore, pelaku: Pelaku, sesiId: string,
  data: { tunaiDihitung: number; qrisMerchant: number; disetor: number; ditinggal: number; catatan: string },
  pesanan: Pesanan[], pengeluaran: Pengeluaran[],
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const sesiSnap = await tx.get(sesiRef(db, sesiId));
    const penanda = (await tx.get(sesiAktifRef(db))).data() as SesiAktif | undefined;
    if (!sesiSnap.exists()) throw new Error('Sesi kas tidak ditemukan.');
    const sesi = dariDoc<SesiKas>(sesiSnap);
    if (sesi.status !== 'buka' || penanda?.sesiKasId !== sesiId) throw new Error('Sesi kas ini sudah ditutup.');

    // The order list was queried before the transaction. If another device created an order since,
    // the session counter (re-read here, so a concurrent bump retries this check) no longer matches.
    // The rules tie every counter bump to exactly one new order, so the two can only differ while the
    // list is stale. Known R1 gap: a late lunasi/batal or a new pengeluaran does not touch the sesi
    // doc, so it is not detected here; the rules still recheck the close arithmetic but not the sums.
    if (pesanan.length !== sesi.jumlahPesanan) throw new PesananBerubah();

    const ringkasan = ringkasSesi(sesi, pesanan, pengeluaran);
    const kesalahan = validasiTutup({ ringkasan, ...data });
    if (kesalahan.length > 0) throw new Error(kesalahan.join('\n'));

    const catatan = data.catatan.trim();
    tx.update(sesiRef(db, sesiId), {
      status: 'tutup', ditutupOleh: pelaku, ditutupPada: serverTimestamp(),
      tunaiSeharusnya: ringkasan.tunaiSeharusnya, tunaiDihitung: data.tunaiDihitung,
      selisihTunai: data.tunaiDihitung - ringkasan.tunaiSeharusnya,
      qrisAplikasi: ringkasan.penjualanQris, qrisMerchant: data.qrisMerchant,
      selisihQris: data.qrisMerchant - ringkasan.penjualanQris,
      disetor: data.disetor, ditinggal: data.ditinggal, catatan: catatan === '' ? null : catatan,
    });
    tx.set(sesiAktifRef(db), { sesiKasId: null, ditinggalTerakhir: data.ditinggal });
  });
}

/** Everything recorded with a WIB `tanggal` in [dari, sampai] (inclusive, YYYY-MM-DD). */
export async function ambilPeriode(db: Firestore, dari: string, sampai: string): Promise<{
  sesi: SesiKas[]; pesanan: Pesanan[]; pengeluaran: Pengeluaran[]; koreksi: Koreksi[];
}> {
  const ambil = async <T>(koleksi: string) => {
    const snap = await getDocs(query(collection(db, koleksi), where('tanggal', '>=', dari), where('tanggal', '<=', sampai)));
    return snap.docs.map((d) => dariDoc<T>(d));
  };
  const [sesi, pesanan, pengeluaran, koreksi] = await Promise.all([
    ambil<SesiKas>('sesiKas'), ambil<Pesanan>('pesanan'), ambil<Pengeluaran>('pengeluaran'), ambil<Koreksi>('koreksi'),
  ]);
  return { sesi, pesanan, pengeluaran, koreksi };
}
