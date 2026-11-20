// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Pelaku, Pengeluaran, Pengguna, Pesanan, SesiKas } from '../../src/types';

const m = vi.hoisted(() => ({
  ambilPeriode: vi.fn(),
  tambahKoreksi: vi.fn(),
  catatPengeluaran: vi.fn(),
  batalkanPengeluaran: vi.fn(),
}));
vi.mock('../../src/firebase', () => ({ db: {}, auth: {} }));
vi.mock('../../src/data/sesi', () => ({ ambilPeriode: m.ambilPeriode }));
vi.mock('../../src/data/koreksi', () => ({ tambahKoreksi: m.tambahKoreksi }));
vi.mock('../../src/data/pengeluaran', () => ({
  catatPengeluaran: m.catatPengeluaran,
  batalkanPengeluaran: m.batalkanPengeluaran,
  pantauPengeluaranSesi: () => () => {},
}));

import { daftarTab } from '../../src/ui/Kerangka';
import Pembatalan from '../../src/ui/pemilik/Pembatalan';
import PengeluaranPemilik from '../../src/ui/pemilik/PengeluaranPemilik';
import Rekap from '../../src/ui/pemilik/Rekap';
import RiwayatKas from '../../src/ui/pemilik/RiwayatKas';

const pemilik: Pengguna = { uid: 'o1', nama: 'Pak Haji', username: 'haji', peran: 'pemilik', aktif: true };
const budi: Pelaku = { uid: 'u1', nama: 'Budi' };
const waktu = new Date('2026-11-19T10:30:00Z');

function pesanan(o: Partial<Pesanan>): Pesanan {
  return {
    id: 'p', sesiKasId: 's1', tanggal: '2026-11-19', nomor: 1, label: '', catatan: '',
    item: [], total: 0, status: 'lunas', caraBayar: 'tunai', uangDiterima: null,
    jumlahCetak: 0, dibuatOleh: budi, dibuatPada: waktu, dilunasiOleh: budi, dilunasiPada: waktu,
    dibatalkanOleh: null, dibatalkanPada: null, alasanBatal: null, ...o,
  };
}
function pengeluaran(o: Partial<Pengeluaran>): Pengeluaran {
  return {
    id: 'e', sesiKasId: 's1', tanggal: '2026-11-19', kategori: 'Gas', keterangan: '', nominal: 0,
    dariLaci: true, status: 'aktif', dibuatOleh: budi, dibuatPada: waktu,
    dibatalkanOleh: null, dibatalkanPada: null, alasanBatal: null, ...o,
  };
}
// The phone stored seharusnya 100.000 and selisih 0; the records say 100.000 + 30.000 tunai = 130.000.
const sesiTutup: SesiKas = {
  id: 's1', tanggal: '2026-11-19', status: 'tutup', jumlahPesanan: 1, dibukaOleh: budi, dibukaPada: waktu,
  modalAwal: 100000, modalSaran: 100000, alasanUbahModal: null, ditutupOleh: budi,
  ditutupPada: new Date('2026-11-19T15:00:00Z'), tunaiSeharusnya: 100000, tunaiDihitung: 100000, selisihTunai: 0,
  qrisAplikasi: 0, qrisMerchant: 0, selisihQris: 0, disetor: 50000, ditinggal: 50000, catatan: null,
};

let data: { sesi: SesiKas[]; pesanan: Pesanan[]; pengeluaran: Pengeluaran[]; koreksi: unknown[] };
beforeEach(() => {
  data = {
    sesi: [sesiTutup],
    pesanan: [
      pesanan({ id: 'a', total: 30000, item: [{ menuId: 'm1', nama: 'Pecel Lele', harga: 15000, jumlah: 2 }] }),
      pesanan({
        id: 'c', nomor: 3, total: 42000, status: 'batal', dibatalkanOleh: budi,
        dibatalkanPada: new Date('2026-11-19T11:00:00Z'), alasanBatal: 'salah input',
      }),
    ],
    pengeluaran: [
      pengeluaran({
        id: 'x', nominal: 20000, status: 'batal', keterangan: 'tabung', dibatalkanOleh: budi,
        dibatalkanPada: new Date('2026-11-19T12:00:00Z'), alasanBatal: 'dobel',
      }),
      pengeluaran({ id: 'own', sesiKasId: null, dariLaci: false, kategori: 'Beras', nominal: 150000, dibuatOleh: { uid: 'o1', nama: 'Pak Haji' } }),
    ],
    koreksi: [{ id: 'k1', sesiKasId: 's1', tanggal: '2026-11-19', nominal: -2000, catatan: 'uang sobek', dibuatOleh: budi, dibuatPada: waktu }],
  };
  m.ambilPeriode.mockReset().mockImplementation(async () => data);
  m.tambahKoreksi.mockReset().mockResolvedValue(undefined);
  m.catatPengeluaran.mockReset().mockResolvedValue(undefined);
  m.batalkanPengeluaran.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('owner nav', () => {
  it('owner has 5 tabs with Pengeluaran moved into Lainnya; karyawan keeps theirs', () => {
    expect(daftarTab('pemilik').map((t) => t.teks)).toEqual(['Beranda', 'Kasir', 'Pesanan', 'Tutup Kas', 'Lainnya']);
    expect(daftarTab('karyawan').map((t) => t.teks)).toEqual(['Kasir', 'Pesanan', 'Pengeluaran', 'Tutup Kas']);
  });
});

describe('RiwayatKas', () => {
  it('shows selisih from the recomputed figures with the stored figure beside it', async () => {
    const user = userEvent.setup();
    render(<RiwayatKas pengguna={pemilik} />);
    const tombol = await screen.findByRole('button', { name: /Kas 2026-11-19/ });
    expect(tombol.textContent).toContain('Tunai -Rp 30.000');
    expect(tombol.textContent).toContain('Angka tutup tidak cocok dengan catatan');
    await user.click(tombol);
    const baris = (label: string) => screen.getByText(label).parentElement!.textContent;
    expect(baris('Tunai seharusnya')).toBe('Tunai seharusnyaRp 130.000tercatat Rp 100.000');
    expect(baris('Selisih tunai')).toBe('Selisih tunai-Rp 30.000tercatat Rp 0');
    expect(baris('QRIS di aplikasi')).toBe('QRIS di aplikasiRp 0'); // equal: no stored figure shown
    expect(baris('Disetor ke pemilik')).toContain('Rp 50.000');
    expect(screen.getByText('-Rp 2.000 · uang sobek')).toBeTruthy();
  });

  it('adds a negative koreksi with a required note, then fetches again keeping the session expanded', async () => {
    const user = userEvent.setup();
    render(<RiwayatKas pengguna={pemilik} />);
    await user.click(await screen.findByRole('button', { name: /Kas 2026-11-19/ }));
    await user.click(screen.getByRole('button', { name: 'Tambah catatan koreksi' }));
    const dialog = screen.getByRole('dialog', { name: 'Koreksi kas 2026-11-19' });
    const simpan = within(dialog).getByRole('button', { name: 'Simpan Koreksi' });
    expect(simpan).toHaveProperty('disabled', true);
    await user.click(within(dialog).getByRole('button', { name: 'Kurangi (−)' }));
    const nominal = within(dialog).getByLabelText('Nominal');
    await user.clear(nominal);
    await user.type(nominal, '5000');
    await user.type(within(dialog).getByLabelText('Catatan'), 'uang palsu');
    // A real refetch takes a while: the list shows Memuat… in between and is mounted again.
    m.ambilPeriode.mockImplementation(() => new Promise((ok) => setTimeout(() => ok(data), 20)));
    await user.click(simpan);
    expect(await screen.findByText('Memuat…')).toBeTruthy();
    expect(m.tambahKoreksi).toHaveBeenCalledWith({}, { uid: 'o1', nama: 'Pak Haji' }, 's1', -5000, 'uang palsu');
    expect(await screen.findByText('Koreksi -Rp 5.000 untuk kas 2026-11-19 tersimpan.')).toBeTruthy();
    expect(m.ambilPeriode).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('button', { name: 'Tambah catatan koreksi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Kas 2026-11-19/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('allows a zero koreksi', async () => {
    const user = userEvent.setup();
    render(<RiwayatKas pengguna={pemilik} fokus={{ id: 's1', tanggal: '2026-11-19' }} />);
    await user.click(await screen.findByRole('button', { name: 'Tambah catatan koreksi' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Catatan'), 'sudah dicek, aman');
    await user.click(within(dialog).getByRole('button', { name: 'Simpan Koreksi' }));
    expect(m.tambahKoreksi).toHaveBeenCalledWith({}, { uid: 'o1', nama: 'Pak Haji' }, 's1', 0, 'sudah dicek, aman');
  });
});

describe('Pembatalan', () => {
  it('lists cancelled orders and expenses with alasan, waktu and pelaku', async () => {
    render(<Pembatalan fokus={{ id: 'c', tanggal: '2026-11-19' }} />);
    expect(m.ambilPeriode).toHaveBeenCalledWith({}, '2026-11-19', '2026-11-19');
    const order = (await screen.findByText('Pesanan #3')).closest('li')!;
    expect(order.textContent).toContain('Rp 42.000');
    expect(order.textContent).toContain('Sudah dibayar tunai');
    expect(order.textContent).toContain('Alasan: salah input');
    expect(order.textContent).toContain('Dibatalkan Budi, 2026-11-19 18:00');
    const exp = screen.getByText('Pengeluaran Gas').closest('li')!;
    expect(exp.textContent).toContain('Alasan: dobel');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent?.slice(0, 10))).toEqual(['Pengeluara', 'Pesanan #3']);
  });
});

describe('Rekap', () => {
  it('downloads rekap-<dari>-<sampai>.csv', async () => {
    const user = userEvent.setup();
    const buat = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL: buat, revokeObjectURL: vi.fn() });
    let unduhan = '';
    const klik = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      unduhan = this.download;
    });
    render(<Rekap />);
    await user.click(screen.getByRole('button', { name: 'Hari ini' }));
    const dari = (screen.getByLabelText('Dari') as HTMLInputElement).value;
    await user.click(await screen.findByRole('button', { name: 'Unduh CSV' }));
    expect(unduhan).toBe(`rekap-${dari}-${dari}.csv`);
    expect(buat).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled(); // deferred so the download can start
    klik.mockRestore();
  });

  it('shows the summary and the top menu', async () => {
    render(<Rekap />);
    const dari = screen.getByLabelText('Dari');
    // Pick a range holding the fixture day.
    const user = userEvent.setup();
    await user.clear(dari);
    await user.type(dari, '2026-11-19');
    const sampai = screen.getByLabelText('Sampai');
    await user.clear(sampai);
    await user.type(sampai, '2026-11-19');
    const ringkasan = await screen.findByRole('region', { name: 'Ringkasan' });
    expect(within(ringkasan).getByText('Penjualan').parentElement!.textContent).toContain('Rp 30.000');
    expect(within(ringkasan).getByText('Pengeluaran').parentElement!.textContent).toContain('Rp 150.000');
    expect(within(ringkasan).getByText('Koreksi').parentElement!.textContent).toContain('-Rp 2.000');
    expect(screen.getByText('1. Pecel Lele')).toBeTruthy();
  });
});

describe('Pengeluaran Pemilik', () => {
  it('records an owner expense outside the session, never from the drawer, then fetches again', async () => {
    const user = userEvent.setup();
    render(<PengeluaranPemilik pengguna={pemilik} />);
    expect(await screen.findByText('Beras')).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Minyak' }));
    await user.type(screen.getByLabelText('Nominal'), '30000');
    await user.click(screen.getByRole('button', { name: 'Simpan Pengeluaran' }));
    expect(m.catatPengeluaran).toHaveBeenCalledWith({}, { uid: 'o1', nama: 'Pak Haji' }, {
      sesiKasId: null, kategori: 'Minyak', keterangan: '', nominal: 30000, dariLaci: false,
    });
    expect(await screen.findByText('Pengeluaran Minyak Rp 30.000 tersimpan.')).toBeTruthy();
    expect(m.ambilPeriode).toHaveBeenCalledTimes(2);
  });
});
