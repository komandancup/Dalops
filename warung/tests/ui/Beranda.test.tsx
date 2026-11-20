// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rekapPeriode } from '../../src/lib/rekap';
import { tambahHari, tanggalWIB } from '../../src/lib/tanggal';
import { formatRupiah } from '../../src/lib/uang';
import type { Pelaku, Pengeluaran, Pesanan, SesiKas } from '../../src/types';

const m = vi.hoisted(() => ({ ambilPeriode: vi.fn() }));
vi.mock('../../src/firebase', () => ({ db: {}, auth: {} }));
vi.mock('../../src/data/sesi', () => ({ ambilPeriode: m.ambilPeriode }));

import Beranda from '../../src/ui/pemilik/Beranda';

const budi: Pelaku = { uid: 'u1', nama: 'Budi' };
const waktu = new Date('2026-11-20T10:30:00Z');

function pesanan(o: Partial<Pesanan>): Pesanan {
  return {
    id: 'p', sesiKasId: 's1', tanggal: '2026-11-20', nomor: 1, label: '', catatan: '',
    item: [], total: 0, status: 'lunas', caraBayar: 'tunai', uangDiterima: null,
    jumlahCetak: 0, dibuatOleh: budi, dibuatPada: waktu, dilunasiOleh: budi, dilunasiPada: waktu,
    dibatalkanOleh: null, dibatalkanPada: null, alasanBatal: null, ...o,
  };
}
function pengeluaran(o: Partial<Pengeluaran>): Pengeluaran {
  return {
    id: 'e', sesiKasId: 's1', tanggal: '2026-11-20', kategori: 'Gas', keterangan: '', nominal: 0,
    dariLaci: true, status: 'aktif', dibuatOleh: budi, dibuatPada: waktu,
    dibatalkanOleh: null, dibatalkanPada: null, alasanBatal: null, ...o,
  };
}
function sesi(o: Partial<SesiKas>): SesiKas {
  return {
    id: 's1', tanggal: '2026-11-20', status: 'buka', jumlahPesanan: 0, dibukaOleh: budi,
    dibukaPada: new Date('2026-11-20T10:02:00Z'), modalAwal: 100000, modalSaran: 100000, alasanUbahModal: null,
    ditutupOleh: null, ditutupPada: null, tunaiSeharusnya: null, tunaiDihitung: null, selisihTunai: null,
    qrisAplikasi: null, qrisMerchant: null, selisihQris: null, disetor: null, ditinggal: null, catatan: null, ...o,
  };
}

const buka = sesi({});
let data: { sesi: SesiKas[]; pesanan: Pesanan[]; pengeluaran: Pengeluaran[]; koreksi: [] };

beforeEach(() => {
  data = {
    sesi: [buka],
    pesanan: [
      pesanan({ id: 'a', nomor: 1, total: 30000, caraBayar: 'tunai' }),
      pesanan({ id: 'b', nomor: 2, total: 23000, caraBayar: 'qris' }),
      // Paid, then cancelled.
      pesanan({
        id: 'c', nomor: 3, total: 42000, caraBayar: 'tunai', status: 'batal',
        dibatalkanOleh: budi, dibatalkanPada: new Date('2026-11-20T11:00:00Z'), alasanBatal: 'salah input',
      }),
      pesanan({ id: 'd', nomor: 4, total: 15000, status: 'belum_bayar', caraBayar: null, dilunasiOleh: null, dilunasiPada: null }),
      pesanan({ id: 'kemarin', sesiKasId: 's0', tanggal: '2026-11-19', nomor: 1, total: 99000 }),
    ],
    pengeluaran: [pengeluaran({ id: 'x', nominal: 22000 })],
    koreksi: [],
  };
  m.ambilPeriode.mockReset().mockImplementation(async () => data);
});
afterEach(cleanup);

describe('Beranda', () => {
  it("shows today's numbers from rekapPeriode and the cancelled order under Peringatan", async () => {
    render(<Beranda sesi={buka} onBuka={() => {}} />);
    expect(m.ambilPeriode).toHaveBeenCalledWith({}, '2026-11-14', '2026-11-20');

    const r = rekapPeriode(data, '2026-11-20', '2026-11-20');
    const hariIni = await screen.findByRole('region', { name: 'Hari ini' });
    const nilai = (label: string) => within(hariIni).getByText(label).parentElement!.textContent;
    expect(nilai('Penjualan')).toContain(formatRupiah(r.penjualanTotal));
    expect(nilai('Penjualan')).toContain('Rp 53.000');
    expect(nilai('Tunai')).toContain(formatRupiah(r.penjualanTunai));
    expect(nilai('QRIS')).toContain(formatRupiah(r.penjualanQris));
    expect(nilai('Jumlah pesanan')).toContain(String(r.jumlahPesanan));
    expect(nilai('Pengeluaran')).toContain(formatRupiah(r.pengeluaranTotal));
    expect(nilai('Perkiraan laba')).toContain(formatRupiah(r.perkiraanLaba));

    expect(screen.getByText('Buka sejak 17:02 oleh Budi')).toBeTruthy();
    expect(screen.getByText('1 pesanan belum bayar')).toBeTruthy();

    const peringatan = screen.getByRole('region', { name: 'Peringatan' });
    expect(within(peringatan).getByText('Pesanan #3 (Rp 42.000) dibatalkan oleh Budi: salah input')).toBeTruthy();
  });

  it('uses the WIB date of today when no session is open and shows Tutup', async () => {
    data.sesi = [];
    render(<Beranda sesi={null} onBuka={() => {}} />);
    const hari = tanggalWIB(new Date());
    expect(m.ambilPeriode).toHaveBeenCalledWith({}, tambahHari(hari, -6), hari);
    expect(await screen.findByText('Tutup')).toBeTruthy();
  });

  it('opens the detail of a tapped alert', async () => {
    const user = userEvent.setup();
    const onBuka = vi.fn();
    const tutup = sesi({
      id: 's0', tanggal: '2026-11-19', status: 'tutup', ditutupOleh: { uid: 'u2', nama: 'Sari' },
      ditutupPada: new Date('2026-11-19T14:00:00Z'), tunaiSeharusnya: 100000, tunaiDihitung: 100000, selisihTunai: 0,
      qrisAplikasi: 0, qrisMerchant: 0, selisihQris: 0,
    });
    data.sesi = [tutup, buka];
    render(<Beranda sesi={buka} onBuka={onBuka} />);
    // Recomputed: modal 100.000 + tunai 99.000 = 199.000, the phone wrote 100.000.
    const pesan = 'Angka tutup kas 2026-11-19 tidak cocok dengan catatan pesanan (tunai seharusnya Rp 199.000, tercatat Rp 100.000).';
    await user.click((await screen.findByText(pesan)).closest('button')!);
    expect(onBuka).toHaveBeenCalledWith({ halaman: 'riwayat', fokus: { id: 's0', tanggal: '2026-11-19' } });
    await user.click(screen.getByRole('button', { name: /Pesanan #3/ }));
    expect(onBuka).toHaveBeenLastCalledWith({ halaman: 'pembatalan', fokus: { id: 'c', tanggal: '2026-11-20' } });
  });

  it('Muat ulang fetches again; a failed fetch shows Coba lagi', async () => {
    const user = userEvent.setup();
    m.ambilPeriode.mockRejectedValueOnce(Object.assign(new Error('Firebase: x'), { code: 'unavailable' }));
    render(<Beranda sesi={buka} onBuka={() => {}} />);
    expect(await screen.findByText('Tidak ada internet. Periksa sambungan lalu coba lagi.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));
    await screen.findByRole('region', { name: 'Hari ini' });
    await user.click(screen.getByRole('button', { name: 'Muat ulang' }));
    expect(m.ambilPeriode).toHaveBeenCalledTimes(3);
  });
});
