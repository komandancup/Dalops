import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import type { Menu } from '../../src/types';

// getDocs passes through, but a test can run something right after a query returns: that makes the
// query result stale, the way an order from another phone would between the query and the transaction.
// getDoc can be made to fail, like a read on a flaky connection right after a write went through.
const m = vi.hoisted(() => ({ sesudahQuery: null as null | (() => Promise<void>), getDocGagal: false }));
vi.mock('firebase/firestore', async (asli) => {
  const mod = await asli<typeof import('firebase/firestore')>();
  return {
    ...mod,
    getDocs: (async (...args: Parameters<typeof mod.getDocs>) => {
      const hasil = await mod.getDocs(...args);
      const f = m.sesudahQuery;
      m.sesudahQuery = null;
      if (f) await f();
      return hasil;
    }) as typeof mod.getDocs,
    getDoc: (async (...args: Parameters<typeof mod.getDoc>) => {
      if (m.getDocGagal) throw Object.assign(new Error('Firebase: offline'), { code: 'unavailable' });
      return mod.getDoc(...args);
    }) as typeof mod.getDoc,
  };
});

import { bukaSesi, tutupSesi } from '../../src/data/sesi';
import { buatPesanan } from '../../src/data/pesanan';

let env: RulesTestEnvironment;
const BUDI = { uid: 'budi', nama: 'Budi' };
const LELE: Menu = { id: 'lele', nama: 'Pecel Lele', harga: 21000, kategori: 'Makanan', aktif: true, urutan: 1 };
const db = (uid: string): Firestore => env.authenticatedContext(uid).firestore() as unknown as Firestore;

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fixed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) fixed[k] = k.endsWith('Pada') && v !== null ? Timestamp.now() : v;
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
  m.sesudahQuery = null;
  m.getDocGagal = false;
  await seed('users/budi', { nama: BUDI.nama, username: 'budi', peran: 'karyawan', aktif: true });
  await seed('pengaturan/sesiAktif', { sesiKasId: null, ditinggalTerakhir: 100000 });
  const { id, ...rest } = LELE;
  await seed(`menu/${id}`, rest);
});

describe('tutupSesi with a stale order list', () => {
  it('re-queries once when an order lands between the query and the transaction, then closes with it', async () => {
    const d = db('budi');
    const sesi = await bukaSesi(d, BUDI, 100000, null);
    // Another phone records a paid tunai order right after this phone's first query.
    m.sesudahQuery = async () => {
      await buatPesanan(db('budi'), BUDI, sesi.id, [{ menu: LELE, jumlah: 1 }], {
        label: '', catatan: '', bayar: { caraBayar: 'tunai', uangDiterima: 21000 },
      });
    };
    await tutupSesi(d, BUDI, sesi.id, { tunaiDihitung: 121000, qrisMerchant: 0, disetor: 71000, ditinggal: 50000, catatan: '' });
    expect((await getDoc(doc(d, 'sesiKas', sesi.id))).data()).toMatchObject({
      status: 'tutup', tunaiSeharusnya: 121000, selisihTunai: 0, jumlahPesanan: 1,
    });
  });
});

describe('buatPesanan on a flaky connection', () => {
  it('returns the saved order without reading it back after the commit', async () => {
    const d = db('budi');
    const sesi = await bukaSesi(d, BUDI, 100000, null);
    m.getDocGagal = true;
    const sebelum = Date.now();
    const p = await buatPesanan(d, BUDI, sesi.id, [{ menu: LELE, jumlah: 2 }], {
      label: 'Meja 3', catatan: 'pedas', bayar: { caraBayar: 'tunai', uangDiterima: 50000 },
    });
    m.getDocGagal = false;
    expect(p).toMatchObject({
      sesiKasId: sesi.id, tanggal: sesi.tanggal, nomor: 1, label: 'Meja 3', catatan: 'pedas',
      item: [{ menuId: 'lele', nama: 'Pecel Lele', harga: 21000, jumlah: 2 }], total: 42000,
      status: 'lunas', caraBayar: 'tunai', uangDiterima: 50000, jumlahCetak: 0,
      dibuatOleh: BUDI, dilunasiOleh: BUDI, dibatalkanOleh: null, dibatalkanPada: null, alasanBatal: null,
    });
    expect(p.dibuatPada).toBeInstanceOf(Date);
    expect(p.dibuatPada.getTime()).toBeGreaterThanOrEqual(sebelum);
    expect(p.dilunasiPada).toEqual(p.dibuatPada);
    const tersimpan = (await getDoc(doc(d, 'pesanan', p.id))).data();
    expect(tersimpan).toMatchObject({ nomor: 1, total: 42000, status: 'lunas' });
  });

  it('an unpaid order comes back with null payment fields', async () => {
    const d = db('budi');
    const sesi = await bukaSesi(d, BUDI, 100000, null);
    m.getDocGagal = true;
    const p = await buatPesanan(d, BUDI, sesi.id, [{ menu: LELE, jumlah: 1 }], { label: '', catatan: '', bayar: null });
    m.getDocGagal = false;
    expect(p).toMatchObject({ status: 'belum_bayar', caraBayar: null, uangDiterima: null, dilunasiOleh: null, dilunasiPada: null });
  });
});
