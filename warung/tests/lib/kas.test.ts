import { describe, expect, it } from 'vitest';
import { hitungTotal, ringkasSesi, validasiTutup } from '../../src/lib/kas';
import type { ItemPesanan, Pelaku, Pengeluaran, Pesanan, SesiKas } from '../../src/types';

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
    id: 's1', tanggal: '2026-11-20', status: 'buka', jumlahPesanan: 0, pesananTerakhir: null, dibukaOleh: pelaku, dibukaPada: waktu,
    modalAwal: 0, modalSaran: 0, alasanUbahModal: null, ditutupOleh: null, ditutupPada: null,
    tunaiSeharusnya: null, tunaiDihitung: null, selisihTunai: null, qrisAplikasi: null, qrisMerchant: null,
    selisihQris: null, disetor: null, ditinggal: null, catatan: null, ...o,
  };
}

describe('hitungTotal', () => {
  it('menjumlahkan harga x jumlah', () => {
    const item: ItemPesanan[] = [
      { menuId: 'a', nama: 'Pecel Lele', harga: 15000, jumlah: 2 },
      { menuId: 'b', nama: 'Es Teh', harga: 4000, jumlah: 3 },
    ];
    expect(hitungTotal(item)).toBe(42000);
  });
});

const pesanan = [
  buatPesanan({ id: '1', total: 42000, status: 'lunas', caraBayar: 'tunai' }),
  buatPesanan({ id: '2', total: 23000, status: 'lunas', caraBayar: 'qris' }),
  buatPesanan({ id: '3', total: 15000, status: 'batal', caraBayar: 'tunai' }),
  buatPesanan({ id: '4', total: 10000, status: 'belum_bayar', caraBayar: null }),
];
const pengeluaran = [
  buatPengeluaran({ id: 'a', nominal: 30000, dariLaci: true, status: 'aktif' }),
  buatPengeluaran({ id: 'b', nominal: 5000, dariLaci: true, status: 'batal' }),
  buatPengeluaran({ id: 'c', nominal: 50000, dariLaci: false, status: 'aktif' }),
];

describe('ringkasSesi', () => {
  it('menghitung ringkasan sesi', () => {
    const r = ringkasSesi(buatSesi({ modalAwal: 100000 }), pesanan, pengeluaran);
    expect(r).toEqual({
      penjualanTunai: 42000, penjualanQris: 23000, pengeluaranLaci: 30000,
      tunaiSeharusnya: 112000, jumlahBelumBayar: 1,
    });
  });
});

describe('validasiTutup', () => {
  const r = ringkasSesi(buatSesi({ modalAwal: 100000 }), pesanan, pengeluaran);
  const r0 = { ...r, jumlahBelumBayar: 0 };
  const dasar = { ringkasan: r0, tunaiDihitung: 112000, qrisMerchant: 23000, disetor: 62000, ditinggal: 50000, catatan: '' };

  it('menolak jika masih ada pesanan belum bayar', () => {
    expect(validasiTutup({ ringkasan: r, tunaiDihitung: 112000, qrisMerchant: 23000, disetor: 62000, ditinggal: 50000, catatan: '' }))
      .toEqual(['Masih ada 1 pesanan belum bayar. Lunasi atau batalkan dulu.']);
  });
  it('lolos jika semuanya cocok', () => {
    expect(validasiTutup(dasar)).toEqual([]);
  });
  it('meminta catatan jika tunai selisih', () => {
    expect(validasiTutup({ ...dasar, tunaiDihitung: 110000, disetor: 60000, ditinggal: 50000 }))
      .toContain('Uang tunai selisih -Rp 2.000. Tulis catatan.');
  });
  it('meminta catatan jika QRIS selisih', () => {
    expect(validasiTutup({ ...dasar, qrisMerchant: 20000 })).toContain('QRIS selisih -Rp 3.000. Tulis catatan.');
  });
  it('lolos jika selisih dengan catatan', () => {
    expect(validasiTutup({ ...dasar, tunaiDihitung: 110000, catatan: 'uang kembalian salah', disetor: 60000, ditinggal: 50000 })).toEqual([]);
  });
  it('catatan hanya spasi dianggap kosong', () => {
    expect(validasiTutup({ ...dasar, qrisMerchant: 20000, catatan: '   ' })).toContain('QRIS selisih -Rp 3.000. Tulis catatan.');
  });
  it('setor + ditinggal harus sama dengan uang dihitung', () => {
    expect(validasiTutup({ ...dasar, disetor: 60000, ditinggal: 40000 }))
      .toContain('Setor + ditinggal harus sama dengan uang yang dihitung (Rp 112.000).');
  });
});
