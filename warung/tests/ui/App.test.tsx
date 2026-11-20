// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Pengguna, SesiKas } from '../../src/types';

type CbPengguna = (p: Pengguna | null, info?: { alasan: string }) => void;
const m = vi.hoisted(() => ({
  langganan: [] as { cb: CbPengguna; onError?: (e: Error) => void; lepas: () => void }[],
  cbSesi: null as null | ((s: unknown) => void),
  tutupSesi: vi.fn(),
}));
vi.mock('../../src/firebase', () => ({ db: {}, auth: {} }));
vi.mock('../../src/data/auth', () => ({
  masuk: vi.fn(async () => {}),
  keluar: vi.fn(async () => {}),
  pantauPengguna: (_a: unknown, _d: unknown, cb: CbPengguna, onError?: (e: Error) => void) => {
    const l = { cb, onError, lepas: vi.fn() };
    m.langganan.push(l);
    return l.lepas;
  },
}));
vi.mock('../../src/data/sesi', () => ({
  pantauSesiAktif: (_db: unknown, cb: (s: unknown) => void) => {
    m.cbSesi = cb;
    return () => {};
  },
  ambilSesiAktif: vi.fn(async () => ({ aktif: null, modalSaran: 100000 })),
  bukaSesi: vi.fn(),
  tutupSesi: m.tutupSesi,
}));
vi.mock('../../src/data/menu', () => ({ pantauMenu: () => () => {} }));
vi.mock('../../src/data/pesanan', () => ({
  pantauPesananSesi: (_db: unknown, _id: string, cb: (p: unknown[]) => void) => { cb([]); return () => {}; },
}));
vi.mock('../../src/data/pengeluaran', () => ({
  pantauPengeluaranSesi: (_db: unknown, _id: string, cb: (p: unknown[]) => void) => { cb([]); return () => {}; },
}));
vi.mock('../../src/data/pengaturan', () => ({ ambilPengaturan: vi.fn(async () => ({ namaWarung: 'W', qrisStatis: null, namaMerchant: null })) }));

import App from '../../src/ui/App';

const terakhir = () => m.langganan[m.langganan.length - 1];

beforeEach(() => {
  m.langganan = [];
  m.cbSesi = null;
  m.tutupSesi.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('App', () => {
  it('shows an error with Coba lagi instead of loading forever, and re-subscribes', async () => {
    const user = userEvent.setup();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<App />);
    expect(screen.getByText('Memuat…')).toBeTruthy();
    act(() => terakhir().onError!(Object.assign(new Error('Firebase: x'), { code: 'unavailable' })));
    expect(screen.getByText('Tidak ada internet. Periksa sambungan lalu coba lagi.')).toBeTruthy();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
    const pertama = terakhir();
    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(pertama.lepas).toHaveBeenCalled();
    expect(m.langganan).toHaveLength(2);
    act(() => terakhir().cb(null));
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeTruthy();
  });

  it('tells Masuk why the account was signed out', () => {
    render(<App />);
    act(() => terakhir().cb(null));
    act(() => terakhir().cb(null, { alasan: 'Akun ini sudah dinonaktifkan. Hubungi pemilik.' }));
    act(() => terakhir().cb(null)); // the sign-out itself fires a plain null afterwards
    expect(screen.getByText('Akun ini sudah dinonaktifkan. Hubungi pemilik.')).toBeTruthy();
  });

  it('opens Printer settings from the gear icon for an employee', async () => {
    const user = userEvent.setup();
    render(<App />);
    act(() => terakhir().cb({ uid: 'u1', nama: 'Sari', username: 'sari', peran: 'karyawan', aktif: true }));
    await user.click(screen.getByRole('button', { name: 'Pengaturan Printer' }));
    expect(screen.getByRole('heading', { name: 'Printer Struk' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pengaturan Printer' }).getAttribute('aria-current')).toBe('page');
  });

  it('keeps the hand-over message after closing when switching tabs and back', async () => {
    const user = userEvent.setup();
    render(<App />);
    act(() => terakhir().cb({ uid: 'u1', nama: 'Sari', username: 'sari', peran: 'karyawan', aktif: true }));
    act(() => m.cbSesi!({ id: 's1', status: 'buka', tanggal: '2026-11-20', modalAwal: 100000 } as SesiKas));
    const tab = (nama: string) => screen.getAllByRole('button', { name: nama }).find((b) => b.closest('nav'))!;
    await user.click(tab('Tutup Kas'));
    await user.type(screen.getByLabelText('Uang tunai dihitung'), '150000');
    await user.type(screen.getByLabelText('Total QRIS di aplikasi merchant'), '0');
    await user.type(screen.getByLabelText(/Catatan/), 'lebih');
    await user.click(screen.getAllByRole('button', { name: 'Tutup Kas' }).find((b) => !b.closest('nav'))!);
    const pesan = 'Serahkan Rp 50.000 ke pemilik. Tinggalkan Rp 100.000 di laci untuk modal berikutnya.';
    expect(await screen.findByText(pesan)).toBeTruthy();
    act(() => m.cbSesi!(null)); // the listener sees the drawer closed

    await user.click(tab('Pesanan'));
    expect(screen.queryByText(pesan)).toBeNull();
    await user.click(tab('Tutup Kas'));
    expect(screen.getByText(pesan)).toBeTruthy();
  });
});
