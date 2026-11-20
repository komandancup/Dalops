import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import type { Menu } from '../../src/types';
import { GALAT_TANGGAL_HP, ambilPeriode, ambilSesiAktif, bukaSesi, pantauSesiAktif, tutupSesi } from '../../src/data/sesi';
import { batalkanPesanan, buatPesanan, catatCetak, lunasiPesanan } from '../../src/data/pesanan';
import { batalkanPengeluaran, catatPengeluaran, pantauPengeluaranSesi } from '../../src/data/pengeluaran';
import { tambahKoreksi } from '../../src/data/koreksi';
import { ambilPengaturan, simpanPengaturan } from '../../src/data/pengaturan';
import { pantauMenu } from '../../src/data/menu';
import { simpanMenu } from '../../src/data/menu';
import { tanggalWIB } from '../../src/lib/tanggal';

let env: RulesTestEnvironment;

const OWNER = { uid: 'owner', nama: 'Pak Owner' };
const EKS = { uid: 'eks', nama: 'Eks' };
const BUDI = { uid: 'budi', nama: 'Budi' };

/** Compat instance from rules-unit-testing; the modular API accepts it (it unwraps `_delegate`). */
const db = (uid: string): Firestore => env.authenticatedContext(uid).firestore() as unknown as Firestore;

const LELE: Menu = { id: 'lele', nama: 'Pecel Lele', harga: 21000, kategori: 'Makanan', aktif: true, urutan: 1 };
const AYAM: Menu = { id: 'ayam', nama: 'Pecel Ayam', harga: 23000, kategori: 'Makanan', aktif: true, urutan: 2 };
const TEH: Menu = { id: 'teh', nama: 'Es Teh', harga: 5000, kategori: 'Minuman', aktif: true, urutan: 3 };

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fixed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      fixed[k] = k.endsWith('Pada') && v !== null ? Timestamp.now() : v;
    }
    await setDoc(doc(ctx.firestore() as unknown as Firestore, path), fixed);
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-warung',
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed('users/owner', { nama: OWNER.nama, username: 'owner', peran: 'pemilik', aktif: true });
  await seed('users/budi', { nama: BUDI.nama, username: 'budi', peran: 'karyawan', aktif: true });
  await seed('users/eks', { nama: EKS.nama, username: 'eks', peran: 'karyawan', aktif: false });
  await seed('pengaturan/sesiAktif', { sesiKasId: null, ditinggalTerakhir: 100000 });
  for (const m of [LELE, AYAM, TEH]) {
    const { id, ...rest } = m;
    await seed(`menu/${id}`, rest);
  }
});

afterEach(() => {
  vi.useRealTimers();
});

describe('alur shift', () => {
  it('full shift: open, orders, unpaid blocks close, settle, close', async () => {
    const d = db('budi');
    const sesi = await bukaSesi(d, BUDI, 100000, null);
    expect(sesi.status).toBe('buka');
    expect(sesi.modalSaran).toBe(100000);

    // 42000 tunai lunas
    await buatPesanan(d, BUDI, sesi.id, [{ menu: LELE, jumlah: 2 }], {
      label: 'Meja 1', catatan: '', bayar: { caraBayar: 'tunai', uangDiterima: 50000 },
    });
    // 23000 qris lunas
    await buatPesanan(d, BUDI, sesi.id, [{ menu: AYAM, jumlah: 1 }], {
      label: 'Meja 2', catatan: '', bayar: { caraBayar: 'qris', uangDiterima: null },
    });
    // 10000 belum bayar
    const utang = await buatPesanan(d, BUDI, sesi.id, [{ menu: TEH, jumlah: 2 }], {
      label: 'Bungkus', catatan: 'tanpa gula', bayar: null,
    });
    expect(utang.status).toBe('belum_bayar');
    expect(utang.total).toBe(10000);

    const tutup = { tunaiDihitung: 142000, qrisMerchant: 33000, disetor: 92000, ditinggal: 50000, catatan: '' };
    await expect(tutupSesi(d, BUDI, sesi.id, tutup)).rejects.toThrow(/belum bayar/);

    await lunasiPesanan(d, BUDI, utang.id, 'qris', null);
    await tutupSesi(d, BUDI, sesi.id, tutup);

    const snap = await getDoc(doc(d, 'sesiKas', sesi.id));
    expect(snap.data()).toMatchObject({
      status: 'tutup', tunaiSeharusnya: 142000, selisihTunai: 0, qrisAplikasi: 33000, selisihQris: 0,
      disetor: 92000, ditinggal: 50000, ditutupOleh: BUDI,
    });
    expect(await ambilSesiAktif(d)).toEqual({ aktif: null, modalSaran: 50000 });
  });

  it('bukaSesi with a wrong phone date is refused with a friendly message', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + 31 * 24 * 3600_000));
    await expect(bukaSesi(db('budi'), BUDI, 100000, null)).rejects.toThrow(GALAT_TANGGAL_HP);
    vi.useRealTimers();
    expect((await ambilSesiAktif(db('budi'))).aktif).toBeNull();
    const sesi = await bukaSesi(db('budi'), BUDI, 100000, null);
    expect(sesi.tanggal).toBe(tanggalWIB(new Date()));
  });

  it('bukaSesi twice returns existing session', async () => {
    const d = db('budi');
    const a = await bukaSesi(d, BUDI, 100000, null);
    const b = await bukaSesi(d, BUDI, 100000, null);
    expect(b.id).toBe(a.id);
    expect(b.dibukaPada).toBeInstanceOf(Date);
    const aktif = await ambilSesiAktif(d);
    expect(aktif.aktif?.id).toBe(a.id);
  });

  it('nomor increments 1,2,3 within a session', async () => {
    const d = db('budi');
    const sesi = await bukaSesi(d, BUDI, 100000, null);
    const nomor: number[] = [];
    for (let i = 0; i < 3; i++) {
      const p = await buatPesanan(d, BUDI, sesi.id, [{ menu: TEH, jumlah: 1 }], { label: '', catatan: '', bayar: null });
      nomor.push(p.nomor);
    }
    expect(nomor).toEqual([1, 2, 3]);
    expect((await getDoc(doc(d, 'sesiKas', sesi.id))).data()?.jumlahPesanan).toBe(3);
  });

  it('buatPesanan copies nama and harga', async () => {
    const d = db('budi');
    const sesi = await bukaSesi(d, BUDI, 100000, null);
    const p = await buatPesanan(d, BUDI, sesi.id, [{ menu: LELE, jumlah: 1 }], { label: '', catatan: '', bayar: null });

    await simpanMenu(db('owner'), { ...LELE, nama: 'Pecel Lele Jumbo', harga: 25000 });

    const disimpan = (await getDoc(doc(d, 'pesanan', p.id))).data();
    expect(disimpan?.item).toEqual([{ menuId: 'lele', nama: 'Pecel Lele', harga: 21000, jumlah: 1 }]);
    expect(disimpan?.total).toBe(21000);
    expect((await getDoc(doc(d, 'menu', 'lele'))).data()).toMatchObject({ nama: 'Pecel Lele Jumbo', harga: 25000 });
  });

  it('pesanan uses sesi tanggal, not clock date', async () => {
    await seed('sesiKas/s1', {
      tanggal: '2026-11-20', status: 'buka', jumlahPesanan: 0,
      dibukaOleh: BUDI, dibukaPada: 'x', modalAwal: 100000, modalSaran: 100000, alasanUbahModal: null,
      ditutupOleh: null, ditutupPada: null, tunaiSeharusnya: null, tunaiDihitung: null, selisihTunai: null,
      qrisAplikasi: null, qrisMerchant: null, selisihQris: null, disetor: null, ditinggal: null, catatan: null,
    });
    await seed('pengaturan/sesiAktif', { sesiKasId: 's1', ditinggalTerakhir: 100000 });
    // Clock says a different WIB day; the order must still follow the session.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-25T10:00:00+07:00'));

    const p = await buatPesanan(db('budi'), BUDI, 's1', [{ menu: TEH, jumlah: 1 }], {
      label: '', catatan: '', bayar: { caraBayar: 'tunai', uangDiterima: 5000 },
    });
    expect(p.tanggal).toBe('2026-11-20');
    expect(p.status).toBe('lunas');
  });

  it("owner pengeluaran without session gets today's WIB tanggal", async () => {
    const d = db('owner');
    await catatPengeluaran(d, OWNER, {
      sesiKasId: null, kategori: 'Gas', keterangan: 'Gas 3kg', nominal: 22000, dariLaci: false,
    });
    const hariIni = tanggalWIB(new Date());
    const { pengeluaran } = await ambilPeriode(d, hariIni, hariIni);
    expect(pengeluaran).toHaveLength(1);
    expect(pengeluaran[0]).toMatchObject({ sesiKasId: null, tanggal: hariIni, nominal: 22000, status: 'aktif' });
    expect(pengeluaran[0].dibuatPada).toBeInstanceOf(Date);
  });

  it('cancel, print, correction and settings writes satisfy the rules', async () => {
    const d = db('budi');
    const sesi = await bukaSesi(d, BUDI, 100000, null);
    const lunas = await buatPesanan(d, BUDI, sesi.id, [{ menu: TEH, jumlah: 1 }], {
      label: '', catatan: '', bayar: { caraBayar: 'tunai', uangDiterima: 10000 },
    });
    await catatCetak(d, lunas.id);
    await batalkanPesanan(d, BUDI, lunas.id, 'salah input');
    await catatPengeluaran(d, BUDI, { sesiKasId: sesi.id, kategori: 'Minyak', keterangan: '', nominal: 30000, dariLaci: true });

    const o = db('owner');
    await tambahKoreksi(o, OWNER, sesi.id, -2000, 'uang receh hilang');
    const periode = await ambilPeriode(o, sesi.tanggal, sesi.tanggal);
    await batalkanPengeluaran(o, OWNER, periode.pengeluaran[0].id, 'dobel');

    const akhir = await ambilPeriode(o, sesi.tanggal, sesi.tanggal);
    expect(akhir.pesanan[0]).toMatchObject({ status: 'batal', jumlahCetak: 1, dibatalkanOleh: BUDI });
    expect(akhir.pengeluaran[0]).toMatchObject({ status: 'batal', tanggal: sesi.tanggal, dibatalkanOleh: OWNER });
    expect(akhir.koreksi[0]).toMatchObject({ nominal: -2000, tanggal: sesi.tanggal });
    expect(akhir.sesi.map((s) => s.id)).toEqual([sesi.id]);

    await simpanPengaturan(o, { namaWarung: 'Pecel Lele Cak Budi', qrisStatis: null, namaMerchant: null });
    expect(await ambilPengaturan(d)).toEqual({ namaWarung: 'Pecel Lele Cak Budi', qrisStatis: null, namaMerchant: null });
  });

  it('pantauSesiAktif follows open and close', async () => {
    const d = db('budi');
    const dilihat: (string | null)[] = [];
    const lepas = pantauSesiAktif(d, (s) => dilihat.push(s ? s.status : null));
    await vi.waitFor(() => expect(dilihat).toEqual([null]));
    const sesi = await bukaSesi(d, BUDI, 100000, null);
    await vi.waitFor(() => expect(dilihat.at(-1)).toBe('buka'));
    await tutupSesi(d, BUDI, sesi.id, { tunaiDihitung: 100000, qrisMerchant: 0, disetor: 50000, ditinggal: 50000, catatan: '' });
    await vi.waitFor(() => expect(dilihat.at(-1)).toBe(null));
    lepas();
  });

  it('pantauPengeluaranSesi follows only the session expenses, newest first, and reports errors', async () => {
    const d = db('budi');
    const sesi = await bukaSesi(d, BUDI, 100000, null);
    await catatPengeluaran(db('owner'), OWNER, { sesiKasId: null, kategori: 'Gas', keterangan: 'luar sesi', nominal: 22000, dariLaci: false });
    const dilihat: { keterangan: string; status: string }[][] = [];
    const lepas = pantauPengeluaranSesi(d, sesi.id, (l) => dilihat.push(l.map((e) => ({ keterangan: e.keterangan, status: e.status }))));
    await vi.waitFor(() => expect(dilihat.at(-1)).toEqual([]));
    await catatPengeluaran(d, BUDI, { sesiKasId: sesi.id, kategori: 'Minyak', keterangan: 'pertama', nominal: 30000, dariLaci: true });
    await vi.waitFor(() => expect(dilihat.at(-1)?.map((e) => e.keterangan)).toEqual(['pertama']));
    await new Promise((r) => setTimeout(r, 5)); // distinct dibuatPada
    await catatPengeluaran(d, BUDI, { sesiKasId: sesi.id, kategori: 'Gas', keterangan: 'kedua', nominal: 20000, dariLaci: true });
    await vi.waitFor(() => expect(dilihat.at(-1)?.map((e) => e.keterangan)).toEqual(['kedua', 'pertama']));
    const { pengeluaran } = await ambilPeriode(d, sesi.tanggal, sesi.tanggal);
    await batalkanPengeluaran(d, BUDI, pengeluaran.find((e) => e.keterangan === 'pertama')!.id, 'salah catat');
    await vi.waitFor(() => expect(dilihat.at(-1)).toEqual([
      { keterangan: 'kedua', status: 'aktif' }, { keterangan: 'pertama', status: 'batal' },
    ]));
    lepas();

    const cb = vi.fn();
    const onError = vi.fn();
    const lepasEks = pantauPengeluaranSesi(db('eks'), sesi.id, cb, onError);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(cb).not.toHaveBeenCalled();
    lepasEks();
  });

  it('pantauMenu reports errors (inactive user) through onError', async () => {
    const cb = vi.fn();
    const onError = vi.fn();
    const lepas = pantauMenu(db('eks'), cb, onError);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(cb).not.toHaveBeenCalled();
    lepas();
  });

  it('tutupSesi refuses when the queried orders do not match the session count', async () => {
    const d = db('budi');
    const sesi = await bukaSesi(d, BUDI, 100000, null);
    // Simulates an order created by another device after the query: the counter is ahead of the list.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore() as unknown as Firestore, 'sesiKas', sesi.id), { jumlahPesanan: 1 }, { merge: true });
    });
    await expect(tutupSesi(d, BUDI, sesi.id, {
      tunaiDihitung: 100000, qrisMerchant: 0, disetor: 50000, ditinggal: 50000, catatan: '',
    })).rejects.toThrow('Ada pesanan baru masuk. Coba tutup kas lagi.');
    expect((await getDoc(doc(d, 'sesiKas', sesi.id))).data()?.status).toBe('buka');
  });

  it('lunasiPesanan refuses tunai below total; buatPesanan refuses non-integer jumlah', async () => {
    const d = db('budi');
    const sesi = await bukaSesi(d, BUDI, 100000, null);
    const p = await buatPesanan(d, BUDI, sesi.id, [{ menu: LELE, jumlah: 1 }], { label: '', catatan: '', bayar: null });
    await expect(lunasiPesanan(d, BUDI, p.id, 'tunai', 20000)).rejects.toThrow('Uang diterima kurang dari total.');
    for (const jumlah of [0, -1, 1.5]) {
      await expect(buatPesanan(d, BUDI, sesi.id, [{ menu: LELE, jumlah }], { label: '', catatan: '', bayar: null }))
        .rejects.toThrow('Jumlah porsi harus angka bulat lebih dari 0.');
    }
  });
});
