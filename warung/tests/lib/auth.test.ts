import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(async () => {}),
  authCb: null as null | ((u: unknown) => void),
  unsubAuth: vi.fn(),
  unsubDoc: vi.fn(),
  snapOk: null as null | ((s: unknown) => void),
  snapErr: null as null | ((e: unknown) => void),
}));
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: m.signIn,
  signOut: m.signOut,
  onAuthStateChanged: (_a: unknown, cb: (u: unknown) => void) => {
    m.authCb = cb;
    return m.unsubAuth;
  },
}));
vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  onSnapshot: (_r: unknown, ok: (s: unknown) => void, err: (e: unknown) => void) => {
    m.snapOk = ok;
    m.snapErr = err;
    return m.unsubDoc;
  },
}));

import { masuk, pantauPengguna } from '../../src/data/auth';

const auth = {} as never;
const db = {} as never;
const snap = (d: Record<string, unknown> | null) => ({ exists: () => d !== null, data: () => d ?? undefined });

beforeEach(() => {
  vi.clearAllMocks();
  m.snapOk = m.snapErr = m.authCb = null;
});

describe('masuk', () => {
  it.each(['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'])('maps %s', async (code) => {
    m.signIn.mockRejectedValue({ code });
    await expect(masuk(auth, ' Budi ', 'x')).rejects.toThrow('Username atau kata sandi salah.');
    expect(m.signIn).toHaveBeenCalledWith(auth, 'budi@warung.app', 'x');
  });
  it('short-circuits invalid usernames', async () => {
    await expect(masuk(auth, 'a b', 'x')).rejects.toThrow('Username atau kata sandi salah.');
    expect(m.signIn).not.toHaveBeenCalled();
  });
  it('rethrows other errors', async () => {
    m.signIn.mockRejectedValue({ code: 'auth/network-request-failed' });
    await expect(masuk(auth, 'budi', 'x')).rejects.toEqual({ code: 'auth/network-request-failed' });
  });
});

describe('pantauPengguna', () => {
  const aktifDoc = { nama: 'Budi', username: 'budi', peran: 'karyawan', aktif: true };
  it('null when signed out', () => {
    const cb = vi.fn();
    pantauPengguna(auth, db, cb);
    m.authCb!(null);
    expect(cb).toHaveBeenCalledWith(null);
  });
  it('reports active user', () => {
    const cb = vi.fn();
    pantauPengguna(auth, db, cb);
    m.authCb!({ uid: 'u1' });
    m.snapOk!(snap(aktifDoc));
    expect(cb).toHaveBeenCalledWith({ uid: 'u1', ...aktifDoc });
    expect(m.signOut).not.toHaveBeenCalled();
  });
  it('signs out when doc missing', () => {
    const cb = vi.fn();
    pantauPengguna(auth, db, cb);
    m.authCb!({ uid: 'u1' });
    m.snapOk!(snap(null));
    expect(m.signOut).toHaveBeenCalled();
    expect(cb).toHaveBeenCalledWith(null);
  });
  it('signs out when inactive', () => {
    const cb = vi.fn();
    pantauPengguna(auth, db, cb);
    m.authCb!({ uid: 'u1' });
    m.snapOk!(snap({ ...aktifDoc, aktif: false }));
    expect(m.signOut).toHaveBeenCalled();
    expect(cb).toHaveBeenCalledWith(null);
  });
  it('signs out on permission-denied', () => {
    const cb = vi.fn();
    pantauPengguna(auth, db, cb);
    m.authCb!({ uid: 'u1' });
    m.snapErr!({ code: 'permission-denied' });
    expect(m.signOut).toHaveBeenCalled();
    expect(cb).toHaveBeenCalledWith(null);
  });
  it('keeps session on other errors', () => {
    const cb = vi.fn();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    pantauPengguna(auth, db, cb);
    m.authCb!({ uid: 'u1' });
    m.snapErr!({ code: 'unavailable' });
    expect(m.signOut).not.toHaveBeenCalled();
    expect(cb).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it('unsubscribe tears down both listeners', () => {
    const un = pantauPengguna(auth, db, vi.fn());
    m.authCb!({ uid: 'u1' });
    un();
    expect(m.unsubDoc).toHaveBeenCalled();
    expect(m.unsubAuth).toHaveBeenCalled();
  });
});
