import { describe, expect, it } from 'vitest';
import { daftarPeringatan, keCSV, rekapPeriode } from '../../src/lib/rekap';
import type { Koreksi, Pelaku, Pengeluaran, Pesanan, SesiKas } from '../../src/types';

const pelaku: Pelaku = { uid: 'u1', nama: 'Budi' };
const waktu = new Date('2026-11-20T03:00:00Z');

function buatPesanan(o: Partial<Pesanan>): Pesanan {
  return {
    id: 'p', sesiKasId: 's1', tanggal: '2026-11-20', nomor: 1, label: '', catatan: '',
    item: [], total: 0, status: 'lunas', caraBayar: 'tunai', uangDiterima: null,
    jumlahCetak: 0, dibuatOleh: pelaku, dibuatPada: waktu, dilunasiOleh: null, dilunasiPada: null,
    dibatalkanOleh: null, dibatalkanPada: null, alasanBatal: null, ...o,
  };
}
function buatPengeluaran(o: Partial<Pengeluaran>): Pengeluaran {
  return {
    id: 'e', sesiKasId: 's1', tanggal: '2026-11-20', kategori: 'Bahan baku', keterangan: '',
    nominal: 0, dariLaci: true, status: 'aktif', dibuatOleh: pelaku, dibuatPada: waktu,
    dibatalkanOleh: null, dibatalkanPada: null, alasanBatal: null, ...o,
  };
}
function buatSesi(o: Partial<SesiKas>): SesiKas {
  return {
    id: 's1', tanggal: '2026-11-20', status: 'buka', jumlahPesanan: 0, dibukaOleh: pelaku, dibukaPada: waktu,
    modalAwal: 0, modalSaran: 0, alasanUbahModal: null, ditutupOleh: null, ditutupPada: null,
    tunaiSeharusnya: null, tunaiDihitung: null, selisihTunai: null, qrisAplikasi: null, qrisMerchant: null,
    selisihQris: null, disetor: null, ditinggal: null, catatan: null, ...o,
  };
}
function buatKoreksi(o: Partial<Koreksi>): Koreksi {
  return { id: 'k', sesiKasId: 's1', tanggal: '2026-11-20', nominal: 0, catatan: '', dibuatOleh: pelaku, dibuatPada: waktu, ...o };
}

const item = (nama: string, harga: number, jumlah: number) => ({ menuId: nama, nama, harga, jumlah });

const data = {
  pesanan: [
    buatPesanan({ id: '1', tanggal: '2026-11-18', total: 30000, caraBayar: 'tunai', item: [item('Pecel Lele', 15000, 2)] }),
    buatPesanan({ id: '2', tanggal: '2026-11-20', total: 23000, caraBayar: 'qris', item: [item('Pecel Lele', 15000, 1), item('Es Teh', 4000, 2)] }),
    buatPesanan({ id: '3', tanggal: '2026-11-20', total: 99000, status: 'batal', item: [item('Pecel Lele', 15000, 6)] }),
    buatPesanan({ id: '4', tanggal: '2026-11-20', total: 10000, status: 'belum_bayar', caraBayar: null }),
    buatPesanan({ id: '5', tanggal: '2026-11-17', total: 5000, item: [item('Es Teh', 4000, 1)] }),
    buatPesanan({ id: '6', tanggal: '2026-11-21', total: 7000 }),
  ],
  pengeluaran: [
    buatPengeluaran({ id: 'a', tanggal: '2026-11-18', nominal: 10000, kategori: 'Minyak' }),
    buatPengeluaran({ id: 'b', tanggal: '2026-11-20', nominal: 4000, kategori: 'Gas', sesiKasId: null, dariLaci: false }),
    buatPengeluaran({ id: 'c', tanggal: '2026-11-20', nominal: 8000, status: 'batal' }),
    buatPengeluaran({ id: 'd', tanggal: '2026-11-22', nominal: 1000 }),
  ],
  koreksi: [
    buatKoreksi({ id: 'k1', tanggal: '2026-11-19', nominal: -2000 }),
    buatKoreksi({ id: 'k2', tanggal: '2026-11-25', nominal: 500 }),
  ],
};

describe('rekapPeriode', () => {
  const r = rekapPeriode(data, '2026-11-18', '2026-11-20');

  it('menghitung penjualan, pengeluaran, koreksi dan laba', () => {
    expect(r.penjualanTunai).toBe(30000);
    expect(r.penjualanQris).toBe(23000);
    expect(r.penjualanTotal).toBe(53000);
    expect(r.jumlahPesanan).toBe(2);
    expect(r.pengeluaranTotal).toBe(14000);
    expect(r.koreksiTotal).toBe(-2000);
    expect(r.perkiraanLaba).toBe(53000 - 14000 - 2000);
  });

  it('memuat semua kategori pengeluaran, 0 bila kosong', () => {
    expect(r.pengeluaranPerKategori).toEqual({
      'Bahan baku': 0, Minyak: 10000, Gas: 4000, Beras: 0, Kemasan: 0, 'Operasional lain': 0,
    });
  });

  it('perHari memuat setiap tanggal, urut naik, termasuk hari kosong', () => {
    expect(r.perHari).toEqual([
      { tanggal: '2026-11-18', penjualan: 30000, pengeluaran: 10000 },
      { tanggal: '2026-11-19', penjualan: 0, pengeluaran: 0 },
      { tanggal: '2026-11-20', penjualan: 23000, pengeluaran: 4000 },
    ]);
  });

  it('menuTerlaris urut porsi menurun, seri menurut rupiah', () => {
    expect(r.menuTerlaris).toEqual([
      { nama: 'Pecel Lele', porsi: 3, rupiah: 45000 },
      { nama: 'Es Teh', porsi: 2, rupiah: 8000 },
    ]);
    const seri = rekapPeriode({
      pesanan: [buatPesanan({ item: [item('A', 1000, 2), item('B', 5000, 2)] })], pengeluaran: [], koreksi: [],
    }, '2026-11-20', '2026-11-20');
    expect(seri.menuTerlaris.map((m) => m.nama)).toEqual(['B', 'A']);
  });

  it('batas dari/sampai inklusif dan lintas bulan', () => {
    const x = rekapPeriode(data, '2026-11-17', '2026-11-17');
    expect(x.penjualanTotal).toBe(5000);
    expect(rekapPeriode(data, '2026-11-28', '2026-12-02').perHari).toHaveLength(5);
  });
});

describe('daftarPeringatan', () => {
  it('pesanan batal', () => {
    const p = buatPesanan({
      id: 'x', nomor: 3, total: 42000, status: 'batal', dibatalkanOleh: pelaku,
      dibatalkanPada: waktu, alasanBatal: 'salah input',
    });
    const out = daftarPeringatan({ sesi: [], pesanan: [p], pengeluaran: [] });
    expect(out).toEqual([{
      jenis: 'batal_pesanan', waktu, refId: 'x', pesan: 'Pesanan #3 (Rp 42.000) dibatalkan oleh Budi: salah input',
    }]);
  });

  it('pengeluaran batal', () => {
    const e = buatPengeluaran({
      id: 'y', status: 'batal', kategori: 'Gas', nominal: 20000, dibatalkanOleh: pelaku,
      dibatalkanPada: waktu, alasanBatal: 'dobel',
    });
    const out = daftarPeringatan({ sesi: [], pesanan: [], pengeluaran: [e] });
    expect(out[0].jenis).toBe('batal_pengeluaran');
    expect(out[0].pesan).toBe('Pengeluaran Gas (Rp 20.000) dibatalkan oleh Budi: dobel');
  });

  it('selisih tunai, selisih qris dan modal diubah', () => {
    const tutup = new Date('2026-11-20T14:00:00Z');
    const s = buatSesi({
      id: 's9', status: 'tutup', ditutupOleh: { uid: 'u2', nama: 'Sari' }, ditutupPada: tutup,
      selisihTunai: -2000, selisihQris: 500, modalSaran: 100000, modalAwal: 150000,
      alasanUbahModal: 'tambah receh',
    });
    const out = daftarPeringatan({ sesi: [s], pesanan: [], pengeluaran: [] });
    expect(out.map((o) => o.jenis).sort()).toEqual(['modal_diubah', 'selisih_qris', 'selisih_tunai']);
    const by = Object.fromEntries(out.map((o) => [o.jenis, o]));
    expect(by.selisih_tunai.pesan).toBe('Selisih tunai -Rp 2.000 di kas 2026-11-20 (ditutup Sari)');
    expect(by.selisih_tunai.waktu).toEqual(tutup);
    expect(by.selisih_qris.pesan).toBe('Selisih QRIS Rp 500 di kas 2026-11-20 (ditutup Sari)');
    expect(by.modal_diubah.pesan).toBe('Modal awal diubah dari Rp 100.000 jadi Rp 150.000 oleh Budi: tambah receh');
    expect(by.modal_diubah.waktu).toEqual(waktu);
    expect(out.every((o) => o.refId === 's9')).toBe(true);
  });

  it('selisih nol atau belum ditutup tidak menghasilkan apa-apa', () => {
    const s1 = buatSesi({ id: 'a', status: 'tutup', selisihTunai: 0, selisihQris: 0, ditutupOleh: pelaku, ditutupPada: waktu });
    const s2 = buatSesi({ id: 'b' });
    expect(daftarPeringatan({ sesi: [s1, s2], pesanan: [], pengeluaran: [] })).toEqual([]);
  });

  it('terbaru dulu', () => {
    const lama = buatPesanan({ id: 'l', status: 'batal', dibatalkanOleh: pelaku, dibatalkanPada: new Date('2026-11-19T01:00:00Z'), alasanBatal: 'a' });
    const baru = buatPesanan({ id: 'n', status: 'batal', dibatalkanOleh: pelaku, dibatalkanPada: new Date('2026-11-20T01:00:00Z'), alasanBatal: 'b' });
    expect(daftarPeringatan({ sesi: [], pesanan: [lama, baru], pengeluaran: [] }).map((o) => o.refId)).toEqual(['n', 'l']);
  });
});

describe('keCSV', () => {
  it('menulis baris harian dan ringkasan', () => {
    const r = rekapPeriode(data, '2026-11-18', '2026-11-20');
    const lines = keCSV(r, '2026-11-18', '2026-11-20').split('\n');
    expect(lines[0]).toBe('Tanggal,Penjualan,Pengeluaran');
    expect(lines.slice(1, 4)).toEqual(['2026-11-18,30000,10000', '2026-11-19,0,0', '2026-11-20,23000,4000']);
    expect(lines[4]).toBe('');
    expect(lines.slice(5)).toEqual([
      'Penjualan tunai,30000', 'Penjualan QRIS,23000', 'Pengeluaran,14000', 'Koreksi,-2000', 'Perkiraan laba,37000',
    ]);
  });
});
