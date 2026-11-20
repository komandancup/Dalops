import { describe, expect, it, vi } from 'vitest';
import { prosesKaryawan } from '../../api/_lib/karyawanHandler.js';
import type { Pengguna } from '../../src/types';

const pemilik: Pengguna = { uid: 'o1', nama: 'Ibu', username: 'ibu', peran: 'pemilik', aktif: true };
const karyawan: Pengguna = { uid: 'k1', nama: 'Budi', username: 'budi', peran: 'karyawan', aktif: true };

function buatDeps(caller: Pengguna | null = pemilik) {
  return {
    verifikasiToken: vi.fn(async () => ({ uid: caller?.uid ?? 'x' })),
    ambilPengguna: vi.fn(async (uid: string) => (caller && uid === caller.uid ? caller : uid === 'k1' ? karyawan : null)),
    buatAkun: vi.fn(async () => 'baru1'),
    setPassword: vi.fn(async () => {}),
    nonaktifkan: vi.fn(async () => {}),
    simpanPengguna: vi.fn(async () => {}),
    hapusAkun: vi.fn(async () => {}),
  };
}

describe('prosesKaryawan', () => {
  it('401 without token', async () => {
    const r = await prosesKaryawan({ aksi: 'reset', uid: 'k1', password: 'abcdef' }, null, buatDeps());
    expect(r.status).toBe(401);
  });
  it('401 when token invalid', async () => {
    const d = buatDeps();
    d.verifikasiToken.mockRejectedValue(new Error('bad'));
    expect((await prosesKaryawan({}, 'tok', d)).status).toBe(401);
  });
  it('403 for karyawan', async () => {
    const r = await prosesKaryawan({ aksi: 'reset', uid: 'k1', password: 'abcdef' }, 't', buatDeps(karyawan));
    expect(r.status).toBe(403);
  });
  it('403 for inactive owner', async () => {
    const r = await prosesKaryawan({ aksi: 'reset', uid: 'k1', password: 'abcdef' }, 't', buatDeps({ ...pemilik, aktif: false }));
    expect(r.status).toBe(403);
  });
  it('400 on invalid body', async () => {
    const r = await prosesKaryawan('x', 't', buatDeps());
    expect(r).toEqual({ status: 400, body: { ok: false, pesan: 'Permintaan tidak valid.' } });
    expect((await prosesKaryawan({ aksi: 'lain' }, 't', buatDeps())).status).toBe(400);
  });
  it('400 for invalid username', async () => {
    const d = buatDeps();
    const r = await prosesKaryawan({ aksi: 'buat', nama: 'Budi', username: 'Budi!', password: 'abcdef' }, 't', d);
    expect(r.status).toBe(400);
    expect(r.body.pesan).toBe('Username hanya huruf kecil, angka, _ (3–20 karakter).');
    expect(d.buatAkun).not.toHaveBeenCalled();
  });
  it('400 for short password', async () => {
    const d = buatDeps();
    const r = await prosesKaryawan({ aksi: 'buat', nama: 'Budi', username: 'budi2', password: '12345' }, 't', d);
    expect(r.status).toBe(400);
    expect(d.buatAkun).not.toHaveBeenCalled();
  });
  it('creates karyawan', async () => {
    const d = buatDeps();
    const r = await prosesKaryawan({ aksi: 'buat', nama: ' Siti ', username: 'siti', password: 'abcdef' }, 't', d);
    expect(r).toEqual({ status: 200, body: { ok: true, uid: 'baru1' } });
    expect(d.buatAkun).toHaveBeenCalledWith('siti@warung.app', 'abcdef');
    expect(d.simpanPengguna).toHaveBeenCalledWith({ uid: 'baru1', nama: 'Siti', username: 'siti', peran: 'karyawan', aktif: true });
  });
  it('400 for duplicate username', async () => {
    const d = buatDeps();
    d.buatAkun.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/email-already-exists' }));
    const r = await prosesKaryawan({ aksi: 'buat', nama: 'Siti', username: 'siti', password: 'abcdef' }, 't', d);
    expect(r).toEqual({ status: 400, body: { ok: false, pesan: 'Username sudah dipakai.' } });
    expect(d.simpanPengguna).not.toHaveBeenCalled();
  });
  it('rolls back the auth account when saving the profile fails', async () => {
    const d = buatDeps();
    d.simpanPengguna.mockRejectedValue(new Error('boom'));
    const r = await prosesKaryawan({ aksi: 'buat', nama: 'Siti', username: 'siti', password: 'abcdef' }, 't', d);
    expect(r).toEqual({ status: 500, body: { ok: false, pesan: 'Gagal menyimpan data karyawan. Coba lagi.' } });
    expect(d.hapusAkun).toHaveBeenCalledWith('baru1');
  });
  it('reset sets password', async () => {
    const d = buatDeps();
    const r = await prosesKaryawan({ aksi: 'reset', uid: 'k1', password: 'abcdef' }, 't', d);
    expect(r.status).toBe(200);
    expect(d.setPassword).toHaveBeenCalledWith('k1', 'abcdef');
  });
  it('reset rejects short password and unknown uid', async () => {
    expect((await prosesKaryawan({ aksi: 'reset', uid: 'k1', password: '1' }, 't', buatDeps())).status).toBe(400);
    expect((await prosesKaryawan({ aksi: 'reset', uid: 'zzz', password: 'abcdef' }, 't', buatDeps())).status).toBe(404);
  });
  it('nonaktifkan disables and stores aktif false', async () => {
    const d = buatDeps();
    const r = await prosesKaryawan({ aksi: 'nonaktifkan', uid: 'k1' }, 't', d);
    expect(r.status).toBe(200);
    expect(d.nonaktifkan).toHaveBeenCalledWith('k1');
    expect(d.simpanPengguna).toHaveBeenCalledWith({ ...karyawan, aktif: false });
  });
  it('owner cannot nonaktifkan self', async () => {
    const d = buatDeps();
    const r = await prosesKaryawan({ aksi: 'nonaktifkan', uid: 'o1' }, 't', d);
    expect(r.status).toBe(400);
    expect(d.nonaktifkan).not.toHaveBeenCalled();
  });
});
