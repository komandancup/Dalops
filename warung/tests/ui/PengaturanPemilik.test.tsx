// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Menu, Pengguna } from '../../src/types';
import { crc16 } from '../../src/lib/qris';

const m = vi.hoisted(() => ({
  menu: [] as unknown[], orang: [] as unknown[],
  simpanMenu: vi.fn(), simpanPengaturan: vi.fn(), ambilPengaturan: vi.fn(),
  buatKaryawan: vi.fn(), resetSandi: vi.fn(), nonaktifkanKaryawan: vi.fn(), bacaQrDariFile: vi.fn(),
}));
vi.mock('../../src/firebase', () => ({ db: {}, auth: {} }));
vi.mock('../../src/data/menu', () => ({
  simpanMenu: m.simpanMenu,
  pantauMenu: (_d: unknown, cb: (x: unknown[]) => void) => { cb(m.menu); return () => {}; },
}));
vi.mock('../../src/data/pengguna', () => ({
  pantauSemuaPengguna: (_d: unknown, cb: (x: unknown[]) => void) => { cb(m.orang); return () => {}; },
}));
vi.mock('../../src/data/pengaturan', () => ({ ambilPengaturan: m.ambilPengaturan, simpanPengaturan: m.simpanPengaturan }));
vi.mock('../../src/data/karyawan', () => ({
  buatKaryawan: m.buatKaryawan, resetSandi: m.resetSandi, nonaktifkanKaryawan: m.nonaktifkanKaryawan,
}));
vi.mock('../../src/lib/bacaQrGambar', () => ({ bacaQrDariFile: m.bacaQrDariFile }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,AAAA') } }));

import KelolaMenu, { geserMenu } from '../../src/ui/pemilik/KelolaMenu';
import Karyawan from '../../src/ui/pemilik/Karyawan';
import PengaturanWarung from '../../src/ui/pemilik/PengaturanWarung';

const tlv = (tag: string, value: string) => tag + String(value.length).padStart(2, '0') + value;
const BADAN = [tlv('00', '01'), tlv('01', '11'), tlv('26', tlv('00', 'ID.CO.QRIS.WWW')), tlv('52', '5812'), tlv('53', '360'),
  tlv('58', 'ID'), tlv('59', 'WARUNG LELE 1'), tlv('60', 'JAKARTA')].join('') + '6304';
const QRIS = BADAN + crc16(BADAN);

const mk = (id: string, kategori: Menu['kategori'], urutan: number, aktif = true): Menu =>
  ({ id, nama: id, harga: 1000, kategori, aktif, urutan });

beforeEach(() => {
  for (const f of [m.simpanMenu, m.simpanPengaturan, m.buatKaryawan, m.resetSandi, m.nonaktifkanKaryawan]) f.mockReset().mockResolvedValue(undefined);
  m.ambilPengaturan.mockReset().mockResolvedValue({ namaWarung: 'Warung Lele', qrisStatis: null, namaMerchant: null });
  m.bacaQrDariFile.mockReset();
  m.menu = [];
  m.orang = [];
});
afterEach(cleanup);

describe('geserMenu', () => {
  it('swaps within a category and renumbers to 1..n even when urutan values tie', () => {
    const semua = [mk('a', 'Makanan', 1), mk('b', 'Makanan', 1), mk('c', 'Minuman', 1)];
    const hasil = geserMenu(semua, 'b', -1);
    expect(hasil.map((x) => [x.id, x.urutan]).sort()).toEqual([['a', 2], ['c', 3]]); // b stays 1: only changed items are written
  });
  it('does nothing at the edge of a category', () => {
    expect(geserMenu([mk('a', 'Makanan', 1), mk('c', 'Minuman', 2)], 'a', 1)).toEqual([]);
  });
});

describe('KelolaMenu', () => {
  it('Isi contoh menu creates the seven placeholder items, urutan 1..7, aktif', async () => {
    render(<KelolaMenu />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Isi contoh menu' }));
    await waitFor(() => expect(m.simpanMenu).toHaveBeenCalledTimes(7));
    const dikirim = m.simpanMenu.mock.calls.map((c) => c[1]);
    expect(dikirim.map((x) => [x.nama, x.harga, x.kategori, x.urutan, x.aktif])).toEqual([
      ['Pecel Lele', 15000, 'Makanan', 1, true], ['Ayam Penyet', 18000, 'Makanan', 2, true],
      ['Nasi Putih', 5000, 'Nasi & Tambahan', 3, true], ['Tahu/Tempe', 2000, 'Nasi & Tambahan', 4, true],
      ['Es Teh', 4000, 'Minuman', 5, true], ['Teh Hangat', 3000, 'Minuman', 6, true], ['Es Jeruk', 6000, 'Minuman', 7, true],
    ]);
  });

  it('lists by category, has no delete button, and moving down saves the swapped urutan', async () => {
    m.menu = [mk('Lele', 'Makanan', 1), mk('Ayam', 'Makanan', 1), mk('Teh', 'Minuman', 3)];
    render(<KelolaMenu />);
    expect(screen.queryByRole('button', { name: 'Isi contoh menu' })).toBeNull();
    expect(screen.queryByRole('button', { name: /hapus/i })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Turunkan Lele' }));
    await waitFor(() => expect(m.simpanMenu).toHaveBeenCalled());
    const urut = Object.fromEntries(m.simpanMenu.mock.calls.map((c) => [c[1].id, c[1].urutan]));
    expect(urut).toEqual({ Lele: 2 }); // Ayam (1) and Teh (3) already fit 1..3
  });

  it('adds an item at the end of the order', async () => {
    m.menu = [mk('Lele', 'Makanan', 4)];
    const user = userEvent.setup();
    render(<KelolaMenu />);
    await user.click(screen.getByRole('button', { name: 'Tambah Menu' }));
    await user.type(screen.getByLabelText('Nama'), ' Sambal ');
    await user.type(screen.getByLabelText('Harga'), '2500');
    await user.click(screen.getByRole('button', { name: 'Minuman' }));
    await user.click(screen.getByRole('button', { name: 'Simpan Menu' }));
    await waitFor(() => expect(m.simpanMenu).toHaveBeenCalledWith({}, {
      id: undefined, nama: ' Sambal ', harga: 2500, kategori: 'Minuman', aktif: true, urutan: 5,
    }));
  });
});

describe('Karyawan', () => {
  const orang: Pengguna[] = [
    { uid: 'o', nama: 'Bu Ani', username: 'ani', peran: 'pemilik', aktif: true },
    { uid: 'b', nama: 'Budi', username: 'budi', peran: 'karyawan', aktif: true },
  ];

  it('shows Reset sandi / Nonaktifkan only on karyawan rows', () => {
    m.orang = orang;
    render(<Karyawan />);
    expect(screen.getAllByRole('button', { name: 'Reset sandi' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Nonaktifkan' })).toHaveLength(1);
    expect(screen.getByText('Pemilik')).toBeTruthy();
  });

  it('validates username and password client-side with the API messages', async () => {
    const user = userEvent.setup();
    render(<Karyawan />);
    await user.click(screen.getByRole('button', { name: 'Tambah Karyawan' }));
    await user.type(screen.getByLabelText('Nama'), 'Sari');
    await user.type(screen.getByLabelText('Username'), 'Sari!');
    await user.type(screen.getByLabelText('Kata sandi'), '123');
    await user.tab();
    expect(screen.getByText('Username hanya huruf kecil, angka, _ (3–20 karakter).')).toBeTruthy();
    expect(screen.getByText('Kata sandi minimal 6 karakter.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Buat Akun' })).toHaveProperty('disabled', true);
  });

  it('creates an account with a lowercased username', async () => {
    const user = userEvent.setup();
    render(<Karyawan />);
    await user.click(screen.getByRole('button', { name: 'Tambah Karyawan' }));
    await user.type(screen.getByLabelText('Nama'), 'Sari');
    await user.type(screen.getByLabelText('Username'), 'Sari_1');
    await user.type(screen.getByLabelText('Kata sandi'), 'rahasia1');
    await user.click(screen.getByRole('button', { name: 'Buat Akun' }));
    await waitFor(() => expect(m.buatKaryawan).toHaveBeenCalledWith('Sari', 'sari_1', 'rahasia1'));
  });

  it('Nonaktifkan needs the exact name typed before the button enables', async () => {
    m.orang = orang;
    const user = userEvent.setup();
    render(<Karyawan />);
    await user.click(screen.getByRole('button', { name: 'Nonaktifkan' }));
    const tombol = screen.getByRole('button', { name: 'Nonaktifkan Akun' });
    expect(tombol).toHaveProperty('disabled', true);
    await user.type(screen.getByLabelText(/Ketik nama/), 'budi');
    expect(tombol).toHaveProperty('disabled', true);
    await user.clear(screen.getByLabelText(/Ketik nama/));
    await user.type(screen.getByLabelText(/Ketik nama/), 'Budi');
    await user.click(tombol);
    await waitFor(() => expect(m.nonaktifkanKaryawan).toHaveBeenCalledWith('b'));
  });

  it('Reset sandi needs 6+ characters', async () => {
    m.orang = orang;
    const user = userEvent.setup();
    render(<Karyawan />);
    await user.click(screen.getByRole('button', { name: 'Reset sandi' }));
    await user.type(screen.getByLabelText('Kata sandi baru'), '12345');
    expect(screen.getByRole('button', { name: 'Ganti Kata Sandi' })).toHaveProperty('disabled', true);
    await user.type(screen.getByLabelText('Kata sandi baru'), '6');
    await user.click(screen.getByRole('button', { name: 'Ganti Kata Sandi' }));
    await waitFor(() => expect(m.resetSandi).toHaveBeenCalledWith('b', '123456'));
  });
});

describe('PengaturanWarung', () => {
  it('trims a pasted code, shows the merchant, previews and saves exactly the rules key set', async () => {
    const user = userEvent.setup();
    render(<PengaturanWarung />);
    const kolom = await screen.findByLabelText('Tempel kode QRIS');
    await user.click(kolom);
    await user.paste(`  ${QRIS}\n`);
    expect(await screen.findByText('QRIS valid: WARUNG LELE 1')).toBeTruthy();
    expect(screen.getByAltText(/Contoh kode QRIS Rp 1\.000/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Simpan Pengaturan' }));
    await waitFor(() => expect(m.simpanPengaturan).toHaveBeenCalledWith({}, {
      namaWarung: 'Warung Lele', qrisStatis: QRIS, namaMerchant: 'WARUNG LELE 1',
    }));
  });

  it('refuses to save an invalid code and shows the reason', async () => {
    const user = userEvent.setup();
    render(<PengaturanWarung />);
    await user.click(await screen.findByLabelText('Tempel kode QRIS'));
    await user.paste('halo');
    expect(screen.getByText('Bukan kode QRIS (awalnya harus 000201).')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Simpan Pengaturan' })).toHaveProperty('disabled', true);
  });

  it('fills the code from a decoded image, trimmed; says so when no QR is found', async () => {
    const user = userEvent.setup();
    const { container } = render(<PengaturanWarung />);
    await screen.findByLabelText('Tempel kode QRIS');
    const file = container.querySelector('input[type=file]') as HTMLInputElement;
    expect(file.getAttribute('accept')).toBe('image/*');
    expect(file.getAttribute('capture')).toBe('environment');
    m.bacaQrDariFile.mockResolvedValueOnce(null);
    await user.upload(file, new File(['x'], 'a.png', { type: 'image/png' }));
    expect(await screen.findByText(/Kode QR tidak terbaca/)).toBeTruthy();
    m.bacaQrDariFile.mockResolvedValueOnce(` ${QRIS} `);
    await user.upload(file, new File(['x'], 'b.png', { type: 'image/png' }));
    expect(await screen.findByText('QRIS valid: WARUNG LELE 1')).toBeTruthy();
  });
});
