import { describe, expect, it } from 'vitest';
import { cekSesi, daftarPeringatan, keCSV, rekapPeriode } from '../../src/lib/rekap';
import type { Koreksi, Pelaku, Pengeluaran, Pesanan, SesiKas } from '../../src/types';

const pelaku: Pelaku = { uid: 'u1', nama: 'Budi' };
const waktu = new Date('2026-11-20T03:00:00Z');

function buatPesanan(o: Partial<Pesanan>): Pesanan {
  return {
    id: 'p', sesiKasId: 's1', tanggal: '2026-11-20', nomor: 1, label: '', catatan: '',
    item: [], total: 0, status: 'lunas', caraBayar: 'tunai', uangDiterima: null,
    jumlahCetak: 0, dibuatOleh: pelaku, dibuatPada: waktu, dilunasiOleh: null, dilunasiPada: null,
    dibatalkanOleh: null, dibatalkanPada: null, alasanBatal: null, ...o,
    // Unless given, the items add up to the total (one line), like every order the app writes.
    ...(o.item === undefined && o.total ? { item: [{ menuId: 'm', nama: 'Menu', harga: o.total, jumlah: 1 }] } : {}),
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
      tunaiSeharusnya: 150000, tunaiDihitung: 148000, selisihTunai: -2000,
      qrisAplikasi: 0, qrisMerchant: 500, selisihQris: 500, modalSaran: 100000, modalAwal: 150000,
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
    const s1 = buatSesi({
      id: 'a', status: 'tutup', tunaiSeharusnya: 0, tunaiDihitung: 0, selisihTunai: 0,
      qrisAplikasi: 0, qrisMerchant: 0, selisihQris: 0, ditutupOleh: pelaku, ditutupPada: waktu,
    });
    const s2 = buatSesi({ id: 'b' });
    expect(daftarPeringatan({ sesi: [s1, s2], pesanan: [], pengeluaran: [] }, waktu)).toEqual([]);
  });

  it('terbaru dulu', () => {
    const lama = buatPesanan({ id: 'l', status: 'batal', dibatalkanOleh: pelaku, dibatalkanPada: new Date('2026-11-19T01:00:00Z'), alasanBatal: 'a' });
    const baru = buatPesanan({ id: 'n', status: 'batal', dibatalkanOleh: pelaku, dibatalkanPada: new Date('2026-11-20T01:00:00Z'), alasanBatal: 'b' });
    expect(daftarPeringatan({ sesi: [], pesanan: [lama, baru], pengeluaran: [] }).map((o) => o.refId)).toEqual(['n', 'l']);
  });
});

describe('pesanan tidak wajar', () => {
  it('total yang tidak sesuai isi pesanan memicu peringatan merah', () => {
    const p = buatPesanan({ id: 'w', nomor: 7, total: 1000, item: [item('Pecel Lele', 15000, 2)] });
    expect(daftarPeringatan({ sesi: [], pesanan: [p], pengeluaran: [] })).toEqual([{
      jenis: 'pesanan_tidak_wajar', waktu, refId: 'w',
      pesan: 'Pesanan #7 (2026-11-20) tidak wajar: total Rp 1.000 tidak sesuai isi pesanan (Rp 30.000).',
    }]);
  });

  it('jumlah atau harga yang bukan bilangan bulat positif memicu peringatan', () => {
    const salah = [
      { harga: 15000, jumlah: -1 },
      { harga: 15000, jumlah: 0 },
      { harga: 15000, jumlah: 1.5 },
      { harga: -15000, jumlah: 1 },
      { harga: 2 ** 60, jumlah: 1 },
      { harga: '15000' as unknown as number, jumlah: 1 },
    ];
    for (const [i, x] of salah.entries()) {
      const p = buatPesanan({ id: `v${i}`, nomor: 8, total: 15000, item: [item('Pecel Lele', 15000, 1), { ...item('Es Teh', 0, 0), ...x }] });
      const out = daftarPeringatan({ sesi: [], pesanan: [p], pengeluaran: [] });
      expect(out).toEqual([{
        jenis: 'pesanan_tidak_wajar', waktu, refId: `v${i}`,
        pesan: 'Pesanan #8 (2026-11-20) tidak wajar: berisi jumlah/harga tidak valid.',
      }]);
    }
  });

  it('pesanan wajar atau sudah batal tidak memicu peringatan ini', () => {
    const wajar = buatPesanan({ id: 'ok', total: 38000, item: [item('Pecel Lele', 15000, 2), item('Es Teh', 4000, 2)] });
    const belum = buatPesanan({ id: 'bb', total: 15000, status: 'belum_bayar', caraBayar: null, item: [item('Pecel Lele', 15000, 1)] });
    const batal = buatPesanan({ id: 'bt', total: 1, status: 'batal', item: [item('Pecel Lele', 15000, 2)] });
    const out = daftarPeringatan({ sesi: [], pesanan: [wajar, belum, batal], pengeluaran: [] });
    expect(out.filter((o) => o.jenis === 'pesanan_tidak_wajar')).toEqual([]);
  });

  it('pesanan belum bayar yang tidak wajar juga diperingatkan', () => {
    const p = buatPesanan({ id: 'u', nomor: 2, total: 5000, status: 'belum_bayar', caraBayar: null, item: [item('Pecel Lele', 15000, 1)] });
    expect(daftarPeringatan({ sesi: [], pesanan: [p], pengeluaran: [] }).map((o) => o.jenis)).toEqual(['pesanan_tidak_wajar']);
  });
});

describe('kas terlalu lama dibuka', () => {
  const sekarang = new Date('2026-11-20T03:00:00Z'); // 20/11 10:00 WIB

  it('sesi buka dari sebelum kemarin memicu peringatan merah', () => {
    const dibuka = new Date('2026-11-18T10:02:00Z'); // 18/11 17:02 WIB
    const s = buatSesi({ id: 'lama', tanggal: '2026-11-18', dibukaPada: dibuka });
    expect(daftarPeringatan({ sesi: [s], pesanan: [], pengeluaran: [] }, sekarang)).toEqual([{
      jenis: 'kas_terlalu_lama', waktu: dibuka, refId: 'lama',
      pesan: 'Kas dibuka sejak 2026-11-18 17:02 oleh Budi dan belum ditutup.',
    }]);
  });

  it('lebih dari 20 jam terbuka juga memicu peringatan walau tanggalnya kemarin', () => {
    const dibuka = new Date('2026-11-19T06:00:00Z'); // 19/11 13:00 WIB, 21 jam lalu
    const s = buatSesi({ id: 'k', tanggal: '2026-11-19', dibukaPada: dibuka });
    expect(daftarPeringatan({ sesi: [s], pesanan: [], pengeluaran: [] }, sekarang).map((o) => o.jenis)).toEqual(['kas_terlalu_lama']);
  });

  it('kas yang dibuka kemarin sore (kurang dari 20 jam) atau sudah ditutup tidak diperingatkan', () => {
    const kemarinSore = buatSesi({ id: 'a', tanggal: '2026-11-19', dibukaPada: new Date('2026-11-19T10:00:00Z') });
    const tutupLama = buatSesi({
      id: 'b', tanggal: '2026-11-10', dibukaPada: new Date('2026-11-10T10:00:00Z'), status: 'tutup',
      ditutupOleh: pelaku, ditutupPada: new Date('2026-11-10T15:00:00Z'), tunaiSeharusnya: 0, tunaiDihitung: 0,
      selisihTunai: 0, qrisAplikasi: 0, qrisMerchant: 0, selisihQris: 0,
    });
    expect(daftarPeringatan({ sesi: [kemarinSore, tutupLama], pesanan: [], pengeluaran: [] }, sekarang)).toEqual([]);
  });
});

describe('tutup kas dicek ulang dari catatan (R5)', () => {
  const tutup = new Date('2026-11-20T14:00:00Z');
  const sari = { uid: 'u2', nama: 'Sari' };
  // modal 100.000 + tunai 30.000 - laci 10.000 = 120.000 seharusnya; QRIS 23.000.
  const pesananS = [
    buatPesanan({ id: 'p1', sesiKasId: 's5', total: 30000, caraBayar: 'tunai', dilunasiOleh: pelaku, dilunasiPada: waktu }),
    buatPesanan({ id: 'p2', sesiKasId: 's5', total: 23000, caraBayar: 'qris' }),
    buatPesanan({ id: 'p3', sesiKasId: 's5', total: 99000, status: 'batal' }),
    buatPesanan({ id: 'lain', sesiKasId: 'sX', total: 50000, caraBayar: 'tunai' }),
  ];
  const pengeluaranS = [
    buatPengeluaran({ id: 'e1', sesiKasId: 's5', nominal: 10000, dariLaci: true }),
    buatPengeluaran({ id: 'e2', sesiKasId: 's5', nominal: 7000, dariLaci: false }),
  ];
  const sesiJujur = buatSesi({
    id: 's5', status: 'tutup', modalAwal: 100000, modalSaran: 100000, ditutupOleh: sari, ditutupPada: tutup,
    tunaiSeharusnya: 120000, tunaiDihitung: 120000, selisihTunai: 0,
    qrisAplikasi: 23000, qrisMerchant: 23000, selisihQris: 0,
  });

  it('angka yang cocok tidak menghasilkan peringatan', () => {
    expect(daftarPeringatan({ sesi: [sesiJujur], pesanan: pesananS, pengeluaran: pengeluaranS })).toEqual([]);
  });

  it('tunai seharusnya yang dikecilkan memicu tutup_tidak_cocok dan selisih dihitung ulang', () => {
    // The phone wrote seharusnya 100.000 so the 20.000 short looks like no difference.
    const s = { ...sesiJujur, tunaiSeharusnya: 100000, tunaiDihitung: 100000, selisihTunai: 0 };
    const out = daftarPeringatan({ sesi: [s], pesanan: pesananS, pengeluaran: pengeluaranS });
    const by = Object.fromEntries(out.map((o) => [o.jenis, o]));
    expect(out.map((o) => o.jenis).sort()).toEqual(['selisih_tunai', 'tutup_tidak_cocok']);
    expect(by.tutup_tidak_cocok).toEqual({
      jenis: 'tutup_tidak_cocok', waktu: tutup, refId: 's5',
      pesan: 'Angka tutup kas 2026-11-20 tidak cocok dengan catatan pesanan (tunai seharusnya Rp 120.000, tercatat Rp 100.000).',
    });
    expect(by.selisih_tunai.pesan).toBe('Selisih tunai -Rp 20.000 di kas 2026-11-20 (ditutup Sari, tercatat Rp 0)');
  });

  it('QRIS aplikasi yang tidak cocok juga memicu tutup_tidak_cocok', () => {
    const s = { ...sesiJujur, qrisAplikasi: 20000, qrisMerchant: 20000, selisihQris: 0 };
    const out = daftarPeringatan({ sesi: [s], pesanan: pesananS, pengeluaran: pengeluaranS });
    expect(out.map((o) => o.pesan).sort()).toEqual([
      'Angka tutup kas 2026-11-20 tidak cocok dengan catatan pesanan (QRIS seharusnya Rp 23.000, tercatat Rp 20.000).',
      'Selisih QRIS -Rp 3.000 di kas 2026-11-20 (ditutup Sari, tercatat Rp 0)',
    ]);
    expect(out.every((o) => o.refId === 's5' && o.waktu === tutup)).toBe(true);
    expect(out.map((o) => o.jenis).sort()).toEqual(['selisih_qris', 'tutup_tidak_cocok']);
  });

  it('kas ditutup dengan pesanan belum bayar', () => {
    const belum = [
      ...pesananS,
      buatPesanan({ id: 'b1', sesiKasId: 's5', total: 10000, status: 'belum_bayar', caraBayar: null }),
      buatPesanan({ id: 'b2', sesiKasId: 's5', total: 12000, status: 'belum_bayar', caraBayar: null }),
    ];
    const out = daftarPeringatan({ sesi: [sesiJujur], pesanan: belum, pengeluaran: pengeluaranS });
    expect(out).toEqual([{
      jenis: 'tutup_tidak_cocok', waktu: tutup, refId: 's5', pesan: 'Kas 2026-11-20 ditutup dengan 2 pesanan belum bayar.',
    }]);
  });

  it('pembatalan sesudah kas ditutup tidak mengubah hitung ulang', () => {
    const sesudah = new Date('2026-11-20T15:00:00Z');
    const sebelum = new Date('2026-11-20T13:00:00Z');
    const pesanan = [
      // Paid tunai, cancelled by the owner after close: still counts as sold at close time.
      { ...pesananS[0], status: 'batal' as const, dibatalkanOleh: pelaku, dibatalkanPada: sesudah, alasanBatal: 'koreksi' },
      pesananS[1], pesananS[2],
      // Unpaid at close, cancelled afterwards: it was still belum bayar when the drawer closed.
      buatPesanan({ id: 'b9', sesiKasId: 's5', total: 8000, status: 'batal', caraBayar: null, dibatalkanOleh: pelaku, dibatalkanPada: sesudah, alasanBatal: 'x' }),
      // Cancelled before close: excluded as usual.
      buatPesanan({ id: 'b8', sesiKasId: 's5', total: 9000, status: 'batal', dibatalkanOleh: pelaku, dibatalkanPada: sebelum, alasanBatal: 'x' }),
    ];
    const pengeluaran = [
      { ...pengeluaranS[0], status: 'batal' as const, dibatalkanOleh: pelaku, dibatalkanPada: sesudah, alasanBatal: 'x' },
      pengeluaranS[1],
    ];
    const c = cekSesi(sesiJujur, pesanan, pengeluaran);
    expect(c.tunaiSeharusnya).toBe(120000);
    expect(c.qrisAplikasi).toBe(23000);
    expect(c.jumlahBelumBayar).toBe(1);
  });

  it('sesi yang masih buka tidak dicek', () => {
    const buka = buatSesi({ id: 's5', modalAwal: 100000 });
    expect(daftarPeringatan({ sesi: [buka], pesanan: pesananS, pengeluaran: pengeluaranS }, waktu)).toEqual([]);
  });

  it('cekSesi memberi angka hitung ulang di samping angka tersimpan', () => {
    const s = { ...sesiJujur, tunaiSeharusnya: 100000, tunaiDihitung: 100000, selisihTunai: 0 };
    expect(cekSesi(s, pesananS, pengeluaranS)).toEqual({
      tunaiSeharusnya: 120000, tunaiSeharusnyaTersimpan: 100000,
      selisihTunai: -20000, selisihTunaiTersimpan: 0,
      qrisAplikasi: 23000, qrisAplikasiTersimpan: 23000,
      selisihQris: 0, selisihQrisTersimpan: 0,
      jumlahBelumBayar: 0, cocok: false,
    });
    expect(cekSesi(sesiJujur, pesananS, pengeluaranS).cocok).toBe(true);
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
