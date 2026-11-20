import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

let env: RulesTestEnvironment;

const OWNER = { uid: 'owner', nama: 'Pak Owner' };
const BUDI = { uid: 'budi', nama: 'Budi' };
const EKS = { uid: 'eks', nama: 'Eks' };

const db = (uid: string): Firestore => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const anon = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;

const item = [{ menuId: 'lele', nama: 'Pecel Lele', harga: 15000, jumlah: 2 }];

function sesiBaru(pelaku = BUDI, extra: Record<string, unknown> = {}) {
  return {
    tanggal: '2026-11-20', status: 'buka', jumlahPesanan: 0,
    dibukaOleh: pelaku, dibukaPada: serverTimestamp(), modalAwal: 50000, modalSaran: 50000, alasanUbahModal: null,
    ditutupOleh: null, ditutupPada: null, tunaiSeharusnya: null, tunaiDihitung: null, selisihTunai: null,
    qrisAplikasi: null, qrisMerchant: null, selisihQris: null, disetor: null, ditinggal: null, catatan: null,
    ...extra,
  };
}

function pesananBaru(nomor: number, pelaku = BUDI, extra: Record<string, unknown> = {}) {
  return {
    sesiKasId: 's1', tanggal: '2026-11-20', nomor, label: 'Meja 1', catatan: '',
    item, total: 30000, status: 'belum_bayar', caraBayar: null, uangDiterima: null, jumlahCetak: 0,
    dibuatOleh: pelaku, dibuatPada: serverTimestamp(), dilunasiOleh: null, dilunasiPada: null,
    dibatalkanOleh: null, dibatalkanPada: null, alasanBatal: null,
    ...extra,
  };
}

function pengeluaranBaru(sesiKasId: string | null, pelaku = BUDI, extra: Record<string, unknown> = {}) {
  return {
    sesiKasId, tanggal: '2026-11-20', kategori: 'Gas', keterangan: 'Gas 3kg', nominal: 22000, dariLaci: true,
    status: 'aktif', dibuatOleh: pelaku, dibuatPada: serverTimestamp(),
    dibatalkanOleh: null, dibatalkanPada: null, alasanBatal: null,
    ...extra,
  };
}

/** Seeds docs bypassing rules. Timestamps are stored as real Timestamps, like serverTimestamp() would. */
async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fixed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      fixed[k] = k.endsWith('Pada') && v !== null ? Timestamp.now() : v;
    }
    await setDoc(doc(ctx.firestore() as unknown as Firestore, path), fixed);
  });
}

/** Seeds an open session s1 (with the marker pointing at it) holding `jumlah` orders. */
async function seedSesiBuka(jumlah = 0) {
  await seed('sesiKas/s1', sesiBaru(BUDI, { jumlahPesanan: jumlah }));
  await seed('pengaturan/sesiAktif', { sesiKasId: 's1', ditinggalTerakhir: 50000 });
}

async function seedSesiTutup() {
  await seed('sesiKas/s1', sesiBaru(BUDI, {
    status: 'tutup', jumlahPesanan: 1, ditutupOleh: BUDI, ditutupPada: 'x',
    tunaiSeharusnya: 80000, tunaiDihitung: 80000, selisihTunai: 0, qrisAplikasi: 0, qrisMerchant: 0, selisihQris: 0,
    disetor: 30000, ditinggal: 50000, catatan: null,
  }));
  await seed('pengaturan/sesiAktif', { sesiKasId: null, ditinggalTerakhir: 50000 });
}

function buatPesananBatch(d: Firestore, id: string, nomor: number, data = pesananBaru(nomor)) {
  const b = writeBatch(d);
  b.set(doc(d, 'pesanan', id), data);
  b.update(doc(d, 'sesiKas', 's1'), { jumlahPesanan: increment(1) });
  return b.commit();
}

function tutupBatch(d: Firestore, pelaku = BUDI, extra: Record<string, unknown> = {}) {
  const b = writeBatch(d);
  b.update(doc(d, 'sesiKas', 's1'), {
    status: 'tutup', ditutupOleh: pelaku, ditutupPada: serverTimestamp(),
    tunaiSeharusnya: 80000, tunaiDihitung: 80000, selisihTunai: 0,
    qrisAplikasi: 0, qrisMerchant: 0, selisihQris: 0, disetor: 30000, ditinggal: 50000, catatan: null,
    ...extra,
  });
  b.set(doc(d, 'pengaturan', 'sesiAktif'), { sesiKasId: null, ditinggalTerakhir: 50000 });
  return b.commit();
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
  await seed('pengaturan/sesiAktif', { sesiKasId: null, ditinggalTerakhir: 50000 });
});

describe('sesi kas', () => {
  it('karyawan can open session when none is open', async () => {
    const d = db('budi');
    const b = writeBatch(d);
    b.set(doc(d, 'sesiKas', 's1'), sesiBaru());
    b.update(doc(d, 'pengaturan', 'sesiAktif'), { sesiKasId: 's1' });
    await assertSucceeds(b.commit());
  });

  it('opening without updating sesiAktif is denied', async () => {
    const d = db('budi');
    await assertFails(setDoc(doc(d, 'sesiKas', 's1'), sesiBaru()));
  });

  it('opening with a changed modal requires alasanUbahModal', async () => {
    const d = db('budi');
    const tanpa = writeBatch(d);
    tanpa.set(doc(d, 'sesiKas', 's1'), sesiBaru(BUDI, { modalAwal: 40000 }));
    tanpa.update(doc(d, 'pengaturan', 'sesiAktif'), { sesiKasId: 's1' });
    await assertFails(tanpa.commit());
    const dengan = writeBatch(d);
    dengan.set(doc(d, 'sesiKas', 's1'), sesiBaru(BUDI, { modalAwal: 40000, alasanUbahModal: 'Ambil kembalian' }));
    dengan.update(doc(d, 'pengaturan', 'sesiAktif'), { sesiKasId: 's1' });
    await assertSucceeds(dengan.commit());
  });

  it('modalSaran must equal sesiAktif.ditinggalTerakhir', async () => {
    const d = db('budi');
    const b = writeBatch(d);
    b.set(doc(d, 'sesiKas', 's1'), sesiBaru(BUDI, { modalAwal: 10000, modalSaran: 10000 }));
    b.update(doc(d, 'pengaturan', 'sesiAktif'), { sesiKasId: 's1' });
    await assertFails(b.commit());
  });

  it('rules: second open session is denied', async () => {
    await seedSesiBuka();
    const d = db('budi');
    const b = writeBatch(d);
    b.set(doc(d, 'sesiKas', 's2'), sesiBaru());
    b.update(doc(d, 'pengaturan', 'sesiAktif'), { sesiKasId: 's2' });
    await assertFails(b.commit());
  });

  it('any active user can close the open session together with sesiAktif', async () => {
    await seedSesiBuka();
    await assertSucceeds(tutupBatch(db('budi')));
    await seedSesiBuka();
    await assertSucceeds(tutupBatch(db('owner'), OWNER));
  });

  it('closing without resetting sesiAktif is denied', async () => {
    await seedSesiBuka();
    const d = db('budi');
    await assertFails(updateDoc(doc(d, 'sesiKas', 's1'), {
      status: 'tutup', ditutupOleh: BUDI, ditutupPada: serverTimestamp(),
      tunaiSeharusnya: 80000, tunaiDihitung: 80000, selisihTunai: 0,
      qrisAplikasi: 0, qrisMerchant: 0, selisihQris: 0, disetor: 30000, ditinggal: 50000, catatan: null,
    }));
  });

  it('closing with a selisih requires catatan; setoran must add up', async () => {
    await seedSesiBuka();
    const d = db('budi');
    await assertFails(tutupBatch(d, BUDI, { tunaiDihitung: 75000, selisihTunai: -5000, disetor: 25000 }));
    await assertFails(tutupBatch(d, BUDI, { disetor: 40000 }));
    await assertSucceeds(tutupBatch(d, BUDI, { tunaiDihitung: 75000, selisihTunai: -5000, disetor: 25000, catatan: 'Kurang' }));
  });

  it('closing with ditutupOleh of someone else is denied', async () => {
    await seedSesiBuka();
    await assertFails(tutupBatch(db('budi'), OWNER));
  });

  it('closed sesiKas cannot be updated', async () => {
    await seedSesiTutup();
    const d = db('owner');
    await assertFails(updateDoc(doc(d, 'sesiKas', 's1'), { catatan: 'ubah' }));
    await assertFails(updateDoc(doc(d, 'sesiKas', 's1'), { jumlahPesanan: increment(1) }));
    await assertFails(updateDoc(doc(d, 'sesiKas', 's1'), { status: 'buka' }));
  });

  it('owner seeds sesiAktif only when absent; karyawan cannot', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore() as unknown as Firestore, 'pengaturan/sesiAktif'));
    });
    await assertFails(setDoc(doc(db('budi'), 'pengaturan', 'sesiAktif'), { sesiKasId: null, ditinggalTerakhir: 0 }));
    await assertSucceeds(setDoc(doc(db('owner'), 'pengaturan', 'sesiAktif'), { sesiKasId: null, ditinggalTerakhir: 0 }));
    await assertFails(setDoc(doc(db('owner'), 'pengaturan', 'sesiAktif'), { sesiKasId: null, ditinggalTerakhir: 999 }));
  });
});

describe('pesanan', () => {
  it('karyawan can create pesanan in open session with nomor = jumlahPesanan+1 and dibuatOleh.uid = self', async () => {
    await seedSesiBuka(2);
    await assertSucceeds(buatPesananBatch(db('budi'), 'p3', 3));
  });

  it('owner can create pesanan too, already lunas', async () => {
    await seedSesiBuka();
    await assertSucceeds(buatPesananBatch(db('owner'), 'p1', 1, pesananBaru(1, OWNER, {
      status: 'lunas', caraBayar: 'tunai', uangDiterima: 50000, dilunasiOleh: OWNER, dilunasiPada: serverTimestamp(),
    })));
  });

  it('pesanan with wrong nomor or without the counter update is denied', async () => {
    await seedSesiBuka(2);
    await assertFails(buatPesananBatch(db('budi'), 'p3', 2));
    await assertFails(setDoc(doc(db('budi'), 'pesanan', 'p3'), pesananBaru(3)));
  });

  it('pesanan in closed session is denied', async () => {
    await seedSesiTutup();
    await assertFails(buatPesananBatch(db('budi'), 'p2', 2));
  });

  it('pesanan with dibuatOleh.uid of someone else is denied', async () => {
    await seedSesiBuka();
    await assertFails(buatPesananBatch(db('budi'), 'p1', 1, pesananBaru(1, OWNER)));
  });

  it('pesanan with total <= 0 or non-int is denied', async () => {
    await seedSesiBuka();
    const d = db('budi');
    await assertFails(buatPesananBatch(d, 'p1', 1, pesananBaru(1, BUDI, { total: 0 })));
    await assertFails(buatPesananBatch(d, 'p1', 1, pesananBaru(1, BUDI, { total: -5000 })));
    await assertFails(buatPesananBatch(d, 'p1', 1, pesananBaru(1, BUDI, { total: 15000.5 })));
    await assertFails(buatPesananBatch(d, 'p1', 1, pesananBaru(1, BUDI, { item: [] })));
    await assertSucceeds(buatPesananBatch(d, 'p1', 1));
  });

  it('belum_bayar → lunas with caraBayar is allowed', async () => {
    await seedSesiBuka(1);
    await seed('pesanan/p1', pesananBaru(1));
    await assertSucceeds(updateDoc(doc(db('budi'), 'pesanan', 'p1'), {
      status: 'lunas', caraBayar: 'qris', uangDiterima: null, dilunasiOleh: BUDI, dilunasiPada: serverTimestamp(),
    }));
  });

  it('lunas without valid caraBayar or in a closed session is denied', async () => {
    await seedSesiBuka(1);
    await seed('pesanan/p1', pesananBaru(1));
    const d = db('budi');
    await assertFails(updateDoc(doc(d, 'pesanan', 'p1'), {
      status: 'lunas', caraBayar: null, dilunasiOleh: BUDI, dilunasiPada: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(d, 'pesanan', 'p1'), {
      status: 'lunas', caraBayar: 'transfer', dilunasiOleh: BUDI, dilunasiPada: serverTimestamp(),
    }));
    await seedSesiTutup();
    await assertFails(updateDoc(doc(d, 'pesanan', 'p1'), {
      status: 'lunas', caraBayar: 'tunai', dilunasiOleh: BUDI, dilunasiPada: serverTimestamp(),
    }));
  });

  it('rules: lunas → lunas is denied', async () => {
    await seedSesiBuka(1);
    await seed('pesanan/p1', pesananBaru(1, BUDI, {
      status: 'lunas', caraBayar: 'tunai', uangDiterima: 50000, dilunasiOleh: BUDI, dilunasiPada: 'x',
    }));
    await assertFails(updateDoc(doc(db('budi'), 'pesanan', 'p1'), {
      status: 'lunas', caraBayar: 'qris', uangDiterima: null, dilunasiOleh: BUDI, dilunasiPada: serverTimestamp(),
    }));
  });

  it('lunas → batal with alasanBatal (non-empty) is allowed', async () => {
    await seedSesiBuka(1);
    await seed('pesanan/p1', pesananBaru(1, BUDI, {
      status: 'lunas', caraBayar: 'tunai', uangDiterima: 50000, dilunasiOleh: BUDI, dilunasiPada: 'x',
    }));
    await assertSucceeds(updateDoc(doc(db('budi'), 'pesanan', 'p1'), {
      status: 'batal', alasanBatal: 'Salah menu', dibatalkanOleh: BUDI, dibatalkanPada: serverTimestamp(),
    }));
  });

  it('batal without alasanBatal is denied', async () => {
    await seedSesiBuka(1);
    await seed('pesanan/p1', pesananBaru(1));
    const d = db('budi');
    await assertFails(updateDoc(doc(d, 'pesanan', 'p1'), {
      status: 'batal', dibatalkanOleh: BUDI, dibatalkanPada: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(d, 'pesanan', 'p1'), {
      status: 'batal', alasanBatal: '   ', dibatalkanOleh: BUDI, dibatalkanPada: serverTimestamp(),
    }));
  });

  it('batal → anything is denied; batal by someone else name is denied', async () => {
    await seedSesiBuka(1);
    await seed('pesanan/p1', pesananBaru(1));
    const d = db('budi');
    await assertFails(updateDoc(doc(d, 'pesanan', 'p1'), {
      status: 'batal', alasanBatal: 'Salah', dibatalkanOleh: OWNER, dibatalkanPada: serverTimestamp(),
    }));
    await seed('pesanan/p1', pesananBaru(1, BUDI, {
      status: 'batal', alasanBatal: 'Salah', dibatalkanOleh: BUDI, dibatalkanPada: 'x',
    }));
    await assertFails(updateDoc(doc(d, 'pesanan', 'p1'), {
      status: 'lunas', caraBayar: 'tunai', dilunasiOleh: BUDI, dilunasiPada: serverTimestamp(),
    }));
  });

  it('karyawan cannot cancel in a closed session; owner can', async () => {
    await seedSesiTutup();
    await seed('pesanan/p1', pesananBaru(1, BUDI, {
      status: 'lunas', caraBayar: 'tunai', uangDiterima: null, dilunasiOleh: BUDI, dilunasiPada: 'x',
    }));
    await assertFails(updateDoc(doc(db('budi'), 'pesanan', 'p1'), {
      status: 'batal', alasanBatal: 'Salah', dibatalkanOleh: BUDI, dibatalkanPada: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(db('owner'), 'pesanan', 'p1'), {
      status: 'batal', alasanBatal: 'Salah', dibatalkanOleh: OWNER, dibatalkanPada: serverTimestamp(),
    }));
  });

  it('changing item/total/harga on update is denied', async () => {
    await seedSesiBuka(1);
    await seed('pesanan/p1', pesananBaru(1));
    const d = db('owner');
    await assertFails(updateDoc(doc(d, 'pesanan', 'p1'), { total: 15000 }));
    await assertFails(updateDoc(doc(d, 'pesanan', 'p1'), {
      item: [{ menuId: 'lele', nama: 'Pecel Lele', harga: 1000, jumlah: 2 }],
    }));
    await assertFails(updateDoc(doc(d, 'pesanan', 'p1'), {
      status: 'lunas', caraBayar: 'tunai', uangDiterima: null, dilunasiOleh: OWNER, dilunasiPada: serverTimestamp(), total: 1000,
    }));
  });

  it('jumlahCetak +1 on lunas allowed; +2 or decrease denied', async () => {
    await seedSesiTutup();
    await seed('pesanan/p1', pesananBaru(1, BUDI, {
      status: 'lunas', caraBayar: 'tunai', uangDiterima: null, dilunasiOleh: BUDI, dilunasiPada: 'x', jumlahCetak: 1,
    }));
    const d = db('budi');
    await assertSucceeds(updateDoc(doc(d, 'pesanan', 'p1'), { jumlahCetak: increment(1) }));
    await assertFails(updateDoc(doc(d, 'pesanan', 'p1'), { jumlahCetak: increment(2) }));
    await assertFails(updateDoc(doc(d, 'pesanan', 'p1'), { jumlahCetak: 0 }));
    await seed('pesanan/p2', pesananBaru(2));
    await assertFails(updateDoc(doc(d, 'pesanan', 'p2'), { jumlahCetak: increment(1) }));
  });
});

describe('pengeluaran', () => {
  it('karyawan can create pengeluaran in open session; not in closed', async () => {
    await seedSesiBuka();
    await assertSucceeds(setDoc(doc(db('budi'), 'pengeluaran', 'e1'), pengeluaranBaru('s1')));
    await seedSesiTutup();
    await assertFails(setDoc(doc(db('budi'), 'pengeluaran', 'e2'), pengeluaranBaru('s1')));
  });

  it('karyawan cannot create pengeluaran with sesiKasId null', async () => {
    await assertFails(setDoc(doc(db('budi'), 'pengeluaran', 'e1'), pengeluaranBaru(null, BUDI, { dariLaci: false })));
  });

  it('owner can create pengeluaran with sesiKasId null', async () => {
    await assertSucceeds(setDoc(doc(db('owner'), 'pengeluaran', 'e1'), pengeluaranBaru(null, OWNER, { dariLaci: false })));
  });

  it('pengeluaran with nominal <= 0, bad kategori or someone else as dibuatOleh is denied', async () => {
    await seedSesiBuka();
    const d = db('budi');
    await assertFails(setDoc(doc(d, 'pengeluaran', 'e1'), pengeluaranBaru('s1', BUDI, { nominal: 0 })));
    await assertFails(setDoc(doc(d, 'pengeluaran', 'e1'), pengeluaranBaru('s1', BUDI, { kategori: 'Rokok' })));
    await assertFails(setDoc(doc(d, 'pengeluaran', 'e1'), pengeluaranBaru('s1', OWNER)));
  });

  it('cancel pengeluaran: karyawan only while session buka with alasan; owner anytime; no other changes', async () => {
    await seedSesiBuka();
    await seed('pengeluaran/e1', pengeluaranBaru('s1'));
    await seed('pengeluaran/e2', pengeluaranBaru(null, OWNER, { dariLaci: false }));
    const d = db('budi');
    await assertFails(updateDoc(doc(d, 'pengeluaran', 'e1'), { nominal: 1000 }));
    await assertFails(updateDoc(doc(d, 'pengeluaran', 'e1'), {
      status: 'batal', alasanBatal: '', dibatalkanOleh: BUDI, dibatalkanPada: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(d, 'pengeluaran', 'e2'), {
      status: 'batal', alasanBatal: 'Dobel', dibatalkanOleh: BUDI, dibatalkanPada: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(db('owner'), 'pengeluaran', 'e2'), {
      status: 'batal', alasanBatal: 'Dobel', dibatalkanOleh: OWNER, dibatalkanPada: serverTimestamp(),
    }));
    await seedSesiTutup();
    await assertFails(updateDoc(doc(d, 'pengeluaran', 'e1'), {
      status: 'batal', alasanBatal: 'Dobel', dibatalkanOleh: BUDI, dibatalkanPada: serverTimestamp(),
    }));
  });
});

describe('append-only and roles', () => {
  it('delete pesanan/pengeluaran/sesiKas/koreksi denied for owner too', async () => {
    await seedSesiBuka(1);
    await seed('pesanan/p1', pesananBaru(1));
    await seed('pengeluaran/e1', pengeluaranBaru('s1'));
    await seed('koreksi/k1', { sesiKasId: 's1', tanggal: '2026-11-20', nominal: 0, catatan: 'cek', dibuatOleh: OWNER, dibuatPada: 'x' });
    for (const uid of ['owner', 'budi']) {
      const d = db(uid);
      await assertFails(deleteDoc(doc(d, 'pesanan', 'p1')));
      await assertFails(deleteDoc(doc(d, 'pengeluaran', 'e1')));
      await assertFails(deleteDoc(doc(d, 'sesiKas', 's1')));
      await assertFails(deleteDoc(doc(d, 'koreksi', 'k1')));
    }
  });

  it('owner can add koreksi; nobody can change it', async () => {
    await seedSesiTutup();
    const d = db('owner');
    await assertSucceeds(setDoc(doc(d, 'koreksi', 'k1'), {
      sesiKasId: 's1', tanggal: '2026-11-20', nominal: -5000, catatan: 'Uang terselip', dibuatOleh: OWNER, dibuatPada: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(d, 'koreksi', 'k1'), { nominal: 0 }));
  });

  it('karyawan cannot write menu/users/pengaturan/warung/koreksi', async () => {
    await seedSesiTutup();
    const d = db('budi');
    await assertFails(setDoc(doc(d, 'menu', 'lele'), { nama: 'Pecel Lele', harga: 1, kategori: 'Makanan', aktif: true, urutan: 1 }));
    await assertFails(updateDoc(doc(d, 'users', 'budi'), { peran: 'pemilik' }));
    await assertFails(setDoc(doc(d, 'users', 'baru'), { nama: 'X', username: 'x', peran: 'karyawan', aktif: true }));
    await assertFails(setDoc(doc(d, 'pengaturan', 'warung'), { namaWarung: 'X', qrisStatis: null, namaMerchant: null }));
    await assertFails(setDoc(doc(d, 'koreksi', 'k1'), {
      sesiKasId: 's1', tanggal: '2026-11-20', nominal: 0, catatan: 'x', dibuatOleh: BUDI, dibuatPada: serverTimestamp(),
    }));
  });

  it('owner can write menu, users and pengaturan/warung', async () => {
    const d = db('owner');
    await assertSucceeds(setDoc(doc(d, 'menu', 'lele'), { nama: 'Pecel Lele', harga: 15000, kategori: 'Makanan', aktif: true, urutan: 1 }));
    await assertSucceeds(updateDoc(doc(d, 'menu', 'lele'), { aktif: false }));
    await assertFails(deleteDoc(doc(d, 'menu', 'lele')));
    await assertSucceeds(updateDoc(doc(d, 'users', 'budi'), { aktif: false }));
    await assertSucceeds(setDoc(doc(d, 'pengaturan', 'warung'), { namaWarung: 'Pecel Lele Cak Budi', qrisStatis: null, namaMerchant: null }));
  });

  it('active users read shared data; users/{uid} only self or pemilik', async () => {
    await seedSesiBuka();
    const d = db('budi');
    await assertSucceeds(getDoc(doc(d, 'sesiKas', 's1')));
    await assertSucceeds(getDoc(doc(d, 'pengaturan', 'sesiAktif')));
    await assertSucceeds(getDoc(doc(d, 'menu', 'lele')));
    await assertSucceeds(getDoc(doc(d, 'users', 'budi')));
    await assertFails(getDoc(doc(d, 'users', 'owner')));
    await assertSucceeds(getDoc(doc(db('owner'), 'users', 'budi')));
  });

  it('inactive user cannot read anything', async () => {
    await seedSesiBuka();
    const d = db('eks');
    await assertFails(getDoc(doc(d, 'sesiKas', 's1')));
    await assertFails(getDoc(doc(d, 'pengaturan', 'sesiAktif')));
    await assertFails(getDoc(doc(d, 'pengaturan', 'warung')));
    await assertFails(getDoc(doc(d, 'menu', 'lele')));
    await assertFails(getDoc(doc(d, 'pesanan', 'p1')));
    await assertFails(getDoc(doc(d, 'pengeluaran', 'e1')));
    await assertFails(getDoc(doc(d, 'koreksi', 'k1')));
    await assertFails(getDoc(doc(d, 'users', 'eks')));
  });

  it('inactive user cannot write anything', async () => {
    await seedSesiBuka();
    await assertFails(buatPesananBatch(db('eks'), 'p1', 1, pesananBaru(1, EKS)));
  });

  it('unauthenticated cannot read anything', async () => {
    await seedSesiBuka();
    const d = anon();
    await assertFails(getDoc(doc(d, 'sesiKas', 's1')));
    await assertFails(getDoc(doc(d, 'pengaturan', 'sesiAktif')));
    await assertFails(getDoc(doc(d, 'menu', 'lele')));
    await assertFails(getDoc(doc(d, 'pesanan', 'p1')));
    await assertFails(getDoc(doc(d, 'users', 'budi')));
  });
});
