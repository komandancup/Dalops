// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Pengguna, Pesanan, SesiKas } from '../../src/types';

const m = vi.hoisted(() => ({
  lunasiPesanan: vi.fn(), batalkanPesanan: vi.fn(), cetakPesanan: vi.fn(), otomatis: false, pesanan: [] as unknown[],
  cb: null as null | ((p: unknown[]) => void),
}));
vi.mock('../../src/firebase', () => ({ db: {}, auth: {} }));
vi.mock('../../src/data/pesanan', () => ({
  lunasiPesanan: m.lunasiPesanan,
  batalkanPesanan: m.batalkanPesanan,
  pantauPesananSesi: (_db: unknown, _id: string, cb: (p: unknown[]) => void) => {
    m.cb = cb;
    cb(m.pesanan);
    return () => {};
  },
}));
vi.mock('../../src/printer/printer', () => ({
  cetakPesanan: m.cetakPesanan, bolehCetak: (p: Pesanan) => p.status === 'lunas', cetakOtomatis: () => m.otomatis,
}));
vi.mock('../../src/data/pengaturan', () => ({
  ambilPengaturan: vi.fn(async () => ({ namaWarung: 'W', qrisStatis: null, namaMerchant: null })),
}));

import DaftarPesanan from '../../src/ui/DaftarPesanan';

const pengguna: Pengguna = { uid: 'u1', nama: 'Sari', username: 'sari', peran: 'karyawan', aktif: true };
const sesi = { id: 's1', status: 'buka', tanggal: '2026-11-20', modalAwal: 100000 } as SesiKas;
const BUDI = { uid: 'u2', nama: 'Budi' };
const pesanan = (p: Partial<Pesanan>) => ({
  label: '', item: [{ menuId: 'm1', nama: 'Pecel Lele', harga: 15000, jumlah: 1 }], total: 15000,
  status: 'lunas', caraBayar: 'tunai', jumlahCetak: 0, dibuatOleh: BUDI, dibatalkanOleh: null, alasanBatal: null, ...p,
}) as Pesanan;

beforeEach(() => {
  m.lunasiPesanan.mockReset().mockResolvedValue(undefined);
  m.batalkanPesanan.mockReset().mockResolvedValue(undefined);
  m.cetakPesanan.mockReset().mockResolvedValue(undefined);
  m.otomatis = false;
  m.pesanan = [
    pesanan({ id: 'p1', nomor: 1 }),
    pesanan({ id: 'p2', nomor: 2, label: 'Meja 3', status: 'belum_bayar', caraBayar: null, total: 34000 }),
    pesanan({ id: 'p3', nomor: 3, caraBayar: 'qris', jumlahCetak: 2 }),
    pesanan({ id: 'p4', nomor: 4, status: 'batal', dibatalkanOleh: BUDI, alasanBatal: 'salah input' }),
  ];
});
afterEach(cleanup);

const render_ = () => render(<DaftarPesanan pengguna={pengguna} sesi={sesi} namaWarung="Warung Lele" />);

describe('DaftarPesanan', () => {
  it('pays an unpaid order through Bayar with lunasiPesanan', async () => {
    const user = userEvent.setup();
    render_();
    expect(screen.getByRole('tab', { name: 'Belum bayar (1)' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Lunas (2)' })).toBeTruthy();
    const baris = screen.getByText('#2').closest('li')!;
    expect(baris.textContent).toContain('Meja 3');
    expect(baris.textContent).toContain('Rp 34.000');
    expect(baris.textContent).toContain('Belum bayar · Dicatat Budi');
    await user.click(within(baris).getByRole('button', { name: 'Bayar' }));
    const dialog = screen.getByRole('dialog', { name: 'Bayar Pesanan #2' });
    await user.click(within(dialog).getByRole('button', { name: 'Tunai' }));
    await user.click(within(dialog).getByRole('button', { name: 'Simpan Lunas' }));
    expect(m.lunasiPesanan).toHaveBeenCalledWith({}, { uid: 'u1', nama: 'Sari' }, 'p2', 'tunai', null);
    expect(await screen.findByText('Pesanan #2 lunas.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(m.cetakPesanan).not.toHaveBeenCalled();
  });

  it('closes Bayar when another phone pays or cancels the order meanwhile', async () => {
    const user = userEvent.setup();
    render_();
    await user.click(within(screen.getByText('#2').closest('li')!).getByRole('button', { name: 'Bayar' }));
    expect(screen.getByRole('dialog', { name: 'Bayar Pesanan #2' })).toBeTruthy();
    // Another phone settles #2: the live list now shows it lunas.
    act(() => m.cb!((m.pesanan as Pesanan[]).map((p) => (p.id === 'p2' ? { ...p, status: 'lunas', caraBayar: 'qris' } : p))));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Pesanan ini sudah dibayar atau dibatalkan di HP lain.');
    expect(m.lunasiPesanan).not.toHaveBeenCalled();
  });

  it("this phone's own payment does not trigger the other-phone message", async () => {
    const user = userEvent.setup();
    // The local write shows up in the live list before lunasiPesanan resolves (latency compensation).
    let selesai = () => {};
    m.lunasiPesanan.mockImplementation(() => {
      m.cb!((m.pesanan as Pesanan[]).map((p) => (p.id === 'p2' ? { ...p, status: 'lunas', caraBayar: 'tunai' } : p)));
      return new Promise<void>((r) => { selesai = r; });
    });
    render_();
    await user.click(within(screen.getByText('#2').closest('li')!).getByRole('button', { name: 'Bayar' }));
    const dialog = screen.getByRole('dialog', { name: 'Bayar Pesanan #2' });
    await user.click(within(dialog).getByRole('button', { name: 'Tunai' }));
    await user.click(within(dialog).getByRole('button', { name: 'Simpan Lunas' }));
    // Still saving: the dialog stays and no other-phone message appears.
    expect(screen.getByRole('dialog', { name: 'Bayar Pesanan #2' })).toBeTruthy();
    expect(screen.queryByText('Pesanan ini sudah dibayar atau dibatalkan di HP lain.')).toBeNull();
    await act(async () => selesai());
    expect(await screen.findByText('Pesanan #2 lunas.')).toBeTruthy();
    expect(screen.queryByText('Pesanan ini sudah dibayar atau dibatalkan di HP lain.')).toBeNull();
  });

  it('prints automatically after paying when the setting is on; a printer failure only shows its error', async () => {
    m.otomatis = true;
    m.cetakPesanan.mockRejectedValue(new Error('Printer tidak tersambung. Cek Bluetooth dan printer.'));
    const user = userEvent.setup();
    render_();
    const baris = screen.getByText('#2').closest('li')!;
    await user.click(within(baris).getByRole('button', { name: 'Bayar' }));
    const dialog = screen.getByRole('dialog', { name: 'Bayar Pesanan #2' });
    await user.click(within(dialog).getByRole('button', { name: 'Tunai' }));
    await user.click(within(dialog).getByRole('button', { name: 'Simpan Lunas' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Printer tidak tersambung. Cek Bluetooth dan printer.');
    expect(screen.getByText('Pesanan #2 lunas.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(m.cetakPesanan).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p2', status: 'lunas', caraBayar: 'tunai', uangDiterima: null, jumlahCetak: 0 }), 'Warung Lele',
    );
  });

  it('prints paid orders (Cetak ulang once printed) and cancels with a required reason', async () => {
    const user = userEvent.setup();
    render_();
    await user.click(screen.getByRole('tab', { name: 'Lunas (2)' }));
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.querySelector('p')!.textContent)).toEqual(['#3', '#1']); // newest first
    expect(within(items[0]).getByText(/QRIS · Dicatat Budi/)).toBeTruthy();
    await user.click(within(items[0]).getByRole('button', { name: 'Cetak ulang' }));
    expect(m.cetakPesanan).toHaveBeenCalledWith(expect.objectContaining({ id: 'p3' }), 'Warung Lele');
    expect(within(items[1]).getByRole('button', { name: 'Cetak struk' })).toBeTruthy();

    m.batalkanPesanan.mockRejectedValueOnce(new Error('Tulis alasan pembatalan.'));
    await user.click(within(items[1]).getByRole('button', { name: 'Batalkan' }));
    const dialog = screen.getByRole('dialog', { name: 'Batalkan Pesanan #1' });
    expect(within(dialog).getByLabelText('Alasan pembatalan').getAttribute('maxlength')).toBe('200'); // rules cap
    const tombol = within(dialog).getByRole('button', { name: 'Batalkan Pesanan' });
    expect(tombol).toHaveProperty('disabled', true);
    await user.type(within(dialog).getByLabelText('Alasan pembatalan'), '  pembeli pergi ');
    await user.click(tombol);
    expect(within(dialog).getByRole('alert').textContent).toBe('Tulis alasan pembatalan.');
    await user.click(tombol);
    expect(m.batalkanPesanan).toHaveBeenLastCalledWith({}, { uid: 'u1', nama: 'Sari' }, 'p1', 'pembeli pergi');
    expect(await screen.findByText('Pesanan #1 dibatalkan.')).toBeTruthy();
  });

  it('shows the cancel reason on the Batal tab without actions', async () => {
    const user = userEvent.setup();
    render_();
    await user.click(screen.getByRole('tab', { name: 'Batal (1)' }));
    expect(screen.getByText('Dibatalkan Budi: salah input')).toBeTruthy();
    expect(within(screen.getByRole('listitem')).queryByRole('button')).toBeNull();
  });
});
