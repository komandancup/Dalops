// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Menu, Pengguna, SesiKas } from '../../src/types';

const m = vi.hoisted(() => ({
  buatPesanan: vi.fn(),
  ambilPengaturan: vi.fn(),
  cetakPesanan: vi.fn(),
  otomatis: false,
}));
vi.mock('../../src/firebase', () => ({ db: {}, auth: {} }));
vi.mock('../../src/data/menu', () => ({
  pantauMenu: (_db: unknown, cb: (menu: Menu[]) => void) => {
    cb(MENU);
    return () => {};
  },
}));
vi.mock('../../src/data/pesanan', () => ({ buatPesanan: m.buatPesanan }));
vi.mock('../../src/data/pengaturan', () => ({ ambilPengaturan: m.ambilPengaturan }));
vi.mock('../../src/printer/printer', () => ({ cetakPesanan: m.cetakPesanan, cetakOtomatis: () => m.otomatis }));

import Kasir from '../../src/ui/Kasir';

const MENU: Menu[] = [
  { id: 'm1', nama: 'Pecel Lele', harga: 15000, kategori: 'Makanan', aktif: true, urutan: 1 },
  { id: 'm2', nama: 'Pecel Ayam', harga: 18000, kategori: 'Makanan', aktif: false, urutan: 2 },
  { id: 'm3', nama: 'Nasi Putih', harga: 4000, kategori: 'Nasi & Tambahan', aktif: true, urutan: 3 },
  { id: 'm4', nama: 'Es Teh', harga: 4000, kategori: 'Minuman', aktif: true, urutan: 4 },
];
const pengguna: Pengguna = { uid: 'u1', nama: 'Sari', username: 'sari', peran: 'karyawan', aktif: true };
const sesi = { id: 's1', status: 'buka', tanggal: '2026-11-20' } as SesiKas;

beforeEach(() => {
  m.buatPesanan.mockReset();
  m.ambilPengaturan.mockReset();
  m.cetakPesanan.mockReset().mockResolvedValue(undefined);
  m.otomatis = false;
  m.ambilPengaturan.mockResolvedValue({ namaWarung: 'Warung', qrisStatis: null, namaMerchant: null });
});
afterEach(cleanup);

async function isiKeranjang() {
  const user = userEvent.setup();
  render(<Kasir pengguna={pengguna} sesi={sesi} namaWarung="Warung Lele" />);
  await user.click(screen.getByRole('button', { name: /Pecel Lele/ }));
  await user.click(screen.getByRole('button', { name: /Pecel Lele/ }));
  await user.click(screen.getByRole('button', { name: /Es Teh/ }));
  return user;
}

async function bukaBayarTunai(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Lihat pesanan/ }));
  await user.click(screen.getByRole('button', { name: 'Bayar Sekarang' }));
  await user.click(screen.getByRole('button', { name: 'Tunai' }));
}

describe('Kasir', () => {
  it('shows only active menu items', () => {
    render(<Kasir pengguna={pengguna} sesi={sesi} namaWarung="Warung Lele" />);
    expect(screen.queryByRole('button', { name: /Pecel Ayam/ })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Minuman' })).toBeTruthy();
  });

  it('adds one portion per tap and shows count and total in the cart bar', async () => {
    await isiKeranjang();
    const bar = screen.getByRole('button', { name: /Lihat pesanan/ });
    expect(bar.textContent).toContain('3 item');
    expect(bar.textContent).toContain('Rp 34.000');
  });

  it('removes a line from the cart when − brings it to 0', async () => {
    const user = await isiKeranjang();
    await user.click(screen.getByRole('button', { name: /Lihat pesanan/ }));
    await user.click(screen.getByRole('button', { name: 'Kurangi Es Teh' }));
    expect(screen.queryByRole('button', { name: 'Kurangi Es Teh' })).toBeNull();
    expect(screen.getByRole('button', { name: /Lihat pesanan/ }).textContent).toContain('Rp 30.000');
  });

  it('shows Kembalian for the cash received', async () => {
    const user = await isiKeranjang();
    await bukaBayarTunai(user);
    await user.type(screen.getByLabelText('Uang diterima'), '50000');
    expect(screen.getByText('Kembalian').parentElement?.textContent).toContain('Rp 16.000');
  });

  it('Simpan Lunas calls buatPesanan once even when clicked twice quickly', async () => {
    let selesai!: () => void;
    m.buatPesanan.mockImplementation(() => new Promise((r) => { selesai = () => r({ id: 'p1', nomor: 1 }); }));
    const user = await isiKeranjang();
    await bukaBayarTunai(user);
    const tombol = screen.getByRole('button', { name: 'Simpan Lunas' });
    await user.dblClick(tombol);
    expect(m.buatPesanan).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Menyimpan…' })).toHaveProperty('disabled', true);
    const [, pelaku, sesiId, keranjang, opsi] = m.buatPesanan.mock.calls[0];
    expect(pelaku).toEqual({ uid: 'u1', nama: 'Sari' });
    expect(sesiId).toBe('s1');
    expect(keranjang.map((k: { menu: Menu; jumlah: number }) => [k.menu.id, k.jumlah])).toEqual([['m1', 2], ['m4', 1]]);
    expect(opsi.bayar).toEqual({ caraBayar: 'tunai', uangDiterima: null });
    selesai();
    expect(await screen.findByText(/tersimpan/)).toBeTruthy();
  });

  it('shows the data layer error message when saving fails', async () => {
    m.buatPesanan.mockRejectedValue(new Error('Kas sudah ditutup. Buka kas dulu.'));
    const user = await isiKeranjang();
    await user.click(screen.getByRole('button', { name: /Lihat pesanan/ }));
    await user.click(screen.getByRole('button', { name: 'Simpan, Bayar Nanti' }));
    expect(await screen.findByText('Kas sudah ditutup. Buka kas dulu.')).toBeTruthy();
    expect(m.buatPesanan.mock.calls[0][4].bayar).toBeNull();
  });

  it('QRIS settings load failure shows the error with Coba lagi that reloads', async () => {
    m.ambilPengaturan.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    const user = await isiKeranjang();
    await user.click(screen.getByRole('button', { name: /Lihat pesanan/ }));
    await user.click(screen.getByRole('button', { name: 'Bayar Sekarang' }));
    await user.click(screen.getByRole('button', { name: 'QRIS' }));
    expect(await screen.findByText(/Gagal memuat QRIS/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByText('QRIS warung belum diatur. Minta pemilik mengisi di Pengaturan.')).toBeTruthy();
    expect(m.ambilPengaturan).toHaveBeenCalledTimes(2);
  });

  it('Escape on the QRIS screen returns to Bayar instead of closing everything', async () => {
    const user = await isiKeranjang();
    await user.click(screen.getByRole('button', { name: /Lihat pesanan/ }));
    await user.click(screen.getByRole('button', { name: 'Bayar Sekarang' }));
    await user.click(screen.getByRole('button', { name: 'QRIS' }));
    await screen.findByRole('dialog', { name: /QRIS/ });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /QRIS/ })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Bayar' })).toBeTruthy();
  });

  it('Escape does not close Bayar while a save is in flight', async () => {
    m.buatPesanan.mockImplementation(() => new Promise(() => {}));
    const user = await isiKeranjang();
    await bukaBayarTunai(user);
    await user.click(screen.getByRole('button', { name: 'Simpan Lunas' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Bayar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tutup' })).toHaveProperty('disabled', true);
  });

  it('QRIS without qrisStatis shows the "belum diatur" message', async () => {
    const user = await isiKeranjang();
    await user.click(screen.getByRole('button', { name: /Lihat pesanan/ }));
    await user.click(screen.getByRole('button', { name: 'Bayar Sekarang' }));
    await user.click(screen.getByRole('button', { name: 'QRIS' }));
    expect(await screen.findByText('QRIS warung belum diatur. Minta pemilik mengisi di Pengaturan.')).toBeTruthy();
    const layar = screen.getByRole('dialog', { name: /QRIS/ });
    expect(within(layar).getByRole('button', { name: 'Ganti ke tunai' })).toBeTruthy();
  });

  it('prints the receipt right after Simpan Lunas when automatic printing is on', async () => {
    m.otomatis = true;
    const lunas = { id: 'p1', nomor: 5, status: 'lunas' };
    m.buatPesanan.mockResolvedValue(lunas);
    const user = await isiKeranjang();
    await bukaBayarTunai(user);
    await user.click(screen.getByRole('button', { name: 'Simpan Lunas' }));
    expect(await screen.findByText('Pesanan #5 tersimpan, lunas.')).toBeTruthy();
    expect(m.cetakPesanan).toHaveBeenCalledWith(lunas, 'Warung Lele');
  });

  it('a printer failure after Simpan Lunas keeps the saved order and only shows the printer error', async () => {
    m.otomatis = true;
    m.buatPesanan.mockResolvedValue({ id: 'p1', nomor: 5, status: 'lunas' });
    m.cetakPesanan.mockRejectedValue(new Error('Printer tidak tersambung. Cek Bluetooth dan printer.'));
    const user = await isiKeranjang();
    await bukaBayarTunai(user);
    await user.click(screen.getByRole('button', { name: 'Simpan Lunas' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Printer tidak tersambung. Cek Bluetooth dan printer.');
    expect(screen.getByText('Pesanan #5 tersimpan, lunas.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(m.buatPesanan).toHaveBeenCalledTimes(1);
  });

  it('does not print automatically when the setting is off or the order is unpaid', async () => {
    m.buatPesanan.mockResolvedValue({ id: 'p1', nomor: 5, status: 'lunas' });
    const user = await isiKeranjang();
    await bukaBayarTunai(user);
    await user.click(screen.getByRole('button', { name: 'Simpan Lunas' }));
    await screen.findByText('Pesanan #5 tersimpan, lunas.');
    m.otomatis = true;
    m.buatPesanan.mockResolvedValue({ id: 'p2', nomor: 6, status: 'belum_bayar' });
    await user.click(screen.getByRole('button', { name: /Pecel Lele/ }));
    await user.click(screen.getByRole('button', { name: /Lihat pesanan/ }));
    await user.click(screen.getByRole('button', { name: 'Simpan, Bayar Nanti' }));
    await screen.findByText('Pesanan #6 tersimpan, belum bayar.');
    expect(m.cetakPesanan).not.toHaveBeenCalled();
  });
});
