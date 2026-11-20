// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Pengeluaran, Pengguna, Pesanan, SesiKas } from '../../src/types';

const m = vi.hoisted(() => ({
  tutupSesi: vi.fn(),
  pesanan: [] as unknown[],
  pengeluaran: [] as unknown[],
  galatPesanan: null as Error | null,
  langganan: 0,
}));
vi.mock('../../src/firebase', () => ({ db: {}, auth: {} }));
vi.mock('../../src/data/sesi', () => ({ tutupSesi: m.tutupSesi }));
vi.mock('../../src/data/pesanan', () => ({
  pantauPesananSesi: (_db: unknown, _id: string, cb: (p: unknown[]) => void, onError?: (e: Error) => void) => {
    m.langganan++;
    if (m.galatPesanan) onError?.(m.galatPesanan);
    else cb(m.pesanan);
    return () => {};
  },
}));
vi.mock('../../src/data/pengeluaran', () => ({
  pantauPengeluaranSesi: (_db: unknown, _id: string, cb: (p: unknown[]) => void) => {
    cb(m.pengeluaran);
    return () => {};
  },
}));

import TutupKas from '../../src/ui/TutupKas';

const pengguna: Pengguna = { uid: 'u1', nama: 'Sari', username: 'sari', peran: 'karyawan', aktif: true };
const sesi = { id: 's1', status: 'buka', tanggal: '2026-11-20', modalAwal: 100000 } as SesiKas;
const pesanan = (p: Partial<Pesanan>) => ({ status: 'lunas', caraBayar: 'tunai', total: 0, ...p }) as Pesanan;

beforeEach(() => {
  m.tutupSesi.mockReset().mockResolvedValue(undefined);
  m.galatPesanan = null;
  m.langganan = 0;
  // modal 100.000 + tunai 22.000 − laci 10.000 = seharusnya 112.000; QRIS 15.000
  m.pesanan = [
    pesanan({ id: 'a', total: 22000 }),
    pesanan({ id: 'b', total: 15000, caraBayar: 'qris' }),
    pesanan({ id: 'c', total: 9000, status: 'batal' }),
  ];
  m.pengeluaran = [
    { id: 'e1', nominal: 10000, dariLaci: true, status: 'aktif' },
    { id: 'e2', nominal: 50000, dariLaci: false, status: 'aktif' },
    { id: 'e3', nominal: 7000, dariLaci: true, status: 'batal' },
  ] as Pengeluaran[];
});
afterEach(cleanup);

const nilai = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;
const tombolTutup = () => screen.getByRole('button', { name: 'Tutup Kas' });

describe('TutupKas', () => {
  it('blind count: hides the expected figures until both counts are entered, then shows them with the selisih', async () => {
    const user = userEvent.setup();
    render(<TutupKas pengguna={pengguna} sesi={sesi} />);
    // Nothing that gives away the target before counting.
    for (const t of ['Uang tunai seharusnya', 'Modal awal', 'Penjualan tunai', 'Pengeluaran dari laci']) {
      expect(screen.queryByText(t)).toBeNull();
    }
    expect(screen.queryByText(/Rp 112\.000/)).toBeNull();
    expect(screen.queryByText(/Menurut aplikasi ini/)).toBeNull();
    expect(screen.getByText('Hitung semua uang di laci sekarang. Angka seharusnya muncul setelah uang tunai dan QRIS diisi.')).toBeTruthy();
    expect(screen.getByText('Lihat total QRIS hari ini di aplikasi merchant. Tulis 0 kalau tidak ada.')).toBeTruthy();
    expect(tombolTutup()).toHaveProperty('disabled', true);

    await user.type(screen.getByLabelText('Uang tunai dihitung'), '110.000');
    // Still hidden with only the cash entered.
    expect(screen.queryByText('Uang tunai seharusnya')).toBeNull();
    expect(screen.queryByText(/Selisih/)).toBeNull();
    expect(screen.queryByText(/Uang tunai selisih/)).toBeNull();

    await user.type(screen.getByLabelText('Total QRIS di aplikasi merchant'), '15000');
    expect(screen.getByText('Uang tunai seharusnya').parentElement?.textContent).toContain('Rp 112.000');
    expect(screen.getByText('Modal awal').parentElement?.textContent).toContain('Rp 100.000');
    expect(screen.getByText('Penjualan tunai').parentElement?.textContent).toContain('Rp 22.000');
    expect(screen.getByText('Pengeluaran dari laci').parentElement?.textContent).toContain('Rp 10.000');
    const selisih = screen.getByText('Selisih -Rp 2.000');
    expect(selisih.className).toContain('text-red');
    expect(screen.getByText('Menurut aplikasi ini: Rp 15.000')).toBeTruthy();
    expect(screen.getByText('Selisih Rp 0').className).not.toContain('text-red');

    // ditinggal prefilled with the session's modal awal, disetor follows dihitung − ditinggal
    expect(nilai('Ditinggal di laci')).toBe('100.000');
    expect(nilai('Disetor ke pemilik')).toBe('10.000');

    expect(screen.getByText('Uang tunai selisih -Rp 2.000. Tulis catatan.')).toBeTruthy();
    expect(tombolTutup()).toHaveProperty('disabled', true);
    await user.click(tombolTutup());
    expect(m.tutupSesi).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Disetor ke pemilik'));
    await user.type(screen.getByLabelText('Disetor ke pemilik'), '60000');
    expect(screen.getByText('Setor + ditinggal harus sama dengan uang yang dihitung (Rp 110.000).')).toBeTruthy();
    await user.clear(screen.getByLabelText('Ditinggal di laci'));
    await user.type(screen.getByLabelText('Ditinggal di laci'), '50000');
    expect(nilai('Disetor ke pemilik')).toBe('60.000'); // an edited disetor no longer follows
    await user.type(screen.getByLabelText(/Catatan/), ' kurang kembalian ');

    expect(tombolTutup()).toHaveProperty('disabled', false);
    await user.click(tombolTutup());
    expect(m.tutupSesi).toHaveBeenCalledTimes(1);
    expect(m.tutupSesi).toHaveBeenCalledWith({}, { uid: 'u1', nama: 'Sari' }, 's1', {
      tunaiDihitung: 110000, qrisMerchant: 15000, disetor: 60000, ditinggal: 50000, catatan: 'kurang kembalian',
    });
    expect(await screen.findByText('Kas sudah ditutup.')).toBeTruthy();
    expect(screen.getByText(/Serahkan Rp 60.000 ke pemilik/)).toBeTruthy();
  });

  it('blocks closing while orders are unpaid and shows data-layer errors', async () => {
    m.pesanan.push(pesanan({ id: 'd', total: 5000, status: 'belum_bayar', caraBayar: null }));
    m.tutupSesi.mockRejectedValue(new Error('Ada pesanan baru masuk. Coba tutup kas lagi.'));
    const user = userEvent.setup();
    const { rerender } = render(<TutupKas pengguna={pengguna} sesi={sesi} />);
    await user.type(screen.getByLabelText('Uang tunai dihitung'), '112000');
    await user.type(screen.getByLabelText('Total QRIS di aplikasi merchant'), '15000');
    expect(screen.getByText('Masih ada 1 pesanan belum bayar. Lunasi atau batalkan dulu.')).toBeTruthy();
    expect(tombolTutup()).toHaveProperty('disabled', true);

    m.pesanan = m.pesanan.slice(0, 3);
    rerender(<TutupKas key="baru" pengguna={pengguna} sesi={sesi} />);
    await user.type(screen.getByLabelText('Uang tunai dihitung'), '112000');
    await user.type(screen.getByLabelText('Total QRIS di aplikasi merchant'), '15000');
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(tombolTutup());
    expect((await screen.findByRole('alert')).textContent).toBe('Ada pesanan baru masuk. Coba tutup kas lagi.');
  });

  it('shows a listener error with Coba lagi that re-subscribes', async () => {
    m.galatPesanan = Object.assign(new Error('Firebase: x'), { code: 'unavailable' });
    const user = userEvent.setup();
    render(<TutupKas pengguna={pengguna} sesi={sesi} />);
    expect(screen.getByText('Tidak ada internet. Periksa sambungan lalu coba lagi.')).toBeTruthy();
    m.galatPesanan = null;
    await act(() => user.click(screen.getByRole('button', { name: 'Coba lagi' })));
    expect(m.langganan).toBe(2);
    expect(screen.getByLabelText('Uang tunai dihitung')).toBeTruthy();
  });

  it('says so when no session is open', () => {
    render(<TutupKas pengguna={pengguna} sesi={null} />);
    expect(screen.getByText('Kas belum dibuka.')).toBeTruthy();
  });
});
