import { emailDariUsername, usernameValid } from '../../src/lib/username.js';
import type { Pengguna } from '../../src/types.js';

export interface KaryawanDeps {
  verifikasiToken(t: string): Promise<{ uid: string }>;
  ambilPengguna(uid: string): Promise<Pengguna | null>;
  buatAkun(email: string, password: string): Promise<string>;
  setPassword(uid: string, pw: string): Promise<void>;
  nonaktifkan(uid: string): Promise<void>;
  simpanPengguna(p: Pengguna): Promise<void>;
  hapusAkun(uid: string): Promise<void>;
}
export interface KaryawanHasil {
  status: number;
  body: { ok: boolean; pesan?: string; uid?: string };
}

const gagal = (status: number, pesan: string): KaryawanHasil => ({ status, body: { ok: false, pesan } });
const str = (v: unknown): v is string => typeof v === 'string';
const MIN_SANDI = 6;
const PESAN_SANDI = `Kata sandi minimal ${MIN_SANDI} karakter.`;

export async function prosesKaryawan(body: unknown, idToken: string | null, deps: KaryawanDeps): Promise<KaryawanHasil> {
  if (!idToken) return gagal(401, 'Silakan masuk dulu.');
  let uidPemanggil: string;
  try {
    uidPemanggil = (await deps.verifikasiToken(idToken)).uid;
  } catch {
    return gagal(401, 'Silakan masuk dulu.');
  }
  const pemanggil = await deps.ambilPengguna(uidPemanggil);
  if (!pemanggil || !pemanggil.aktif || pemanggil.peran !== 'pemilik') return gagal(403, 'Hanya pemilik yang boleh mengelola karyawan.');

  if (typeof body !== 'object' || body === null) return gagal(400, 'Permintaan tidak valid.');
  const b = body as Record<string, unknown>;

  if (b.aksi === 'buat') {
    if (!str(b.nama) || !str(b.username) || !str(b.password) || !b.nama.trim()) return gagal(400, 'Permintaan tidak valid.');
    const username = b.username.trim().toLowerCase();
    if (!usernameValid(username)) return gagal(400, 'Username hanya huruf kecil, angka, _ (3–20 karakter).');
    if (b.password.length < MIN_SANDI) return gagal(400, PESAN_SANDI);
    let uid: string;
    try {
      uid = await deps.buatAkun(emailDariUsername(username), b.password);
    } catch (e) {
      if ((e as { code?: string }).code === 'auth/email-already-exists') return gagal(400, 'Username sudah dipakai.');
      throw e;
    }
    try {
      await deps.simpanPengguna({ uid, nama: b.nama.trim(), username, peran: 'karyawan', aktif: true });
    } catch {
      await deps.hapusAkun(uid).catch(() => {});
      return gagal(500, 'Gagal menyimpan data karyawan. Coba lagi.');
    }
    return { status: 200, body: { ok: true, uid } };
  }

  if (b.aksi === 'reset' || b.aksi === 'nonaktifkan') {
    if (!str(b.uid) || !b.uid) return gagal(400, 'Permintaan tidak valid.');
    if (b.aksi === 'nonaktifkan' && b.uid === uidPemanggil) return gagal(400, 'Akun sendiri tidak bisa dinonaktifkan.');
    if (b.aksi === 'reset' && (!str(b.password) || b.password.length < MIN_SANDI)) return gagal(400, PESAN_SANDI);
    const target = await deps.ambilPengguna(b.uid);
    if (!target) return gagal(404, 'Karyawan tidak ditemukan.');
    if (b.aksi === 'reset') {
      await deps.setPassword(b.uid, b.password as string);
    } else {
      await deps.nonaktifkan(b.uid);
      await deps.simpanPengguna({ ...target, aktif: false });
    }
    return { status: 200, body: { ok: true, uid: b.uid } };
  }

  return gagal(400, 'Permintaan tidak valid.');
}
