import { hitungTotal, ringkasSesi } from './kas';
import { jamWIB, tambahHari, tanggalWIB } from './tanggal';
import { formatRupiah } from './uang';
import type { KategoriPengeluaran, Koreksi, Pengeluaran, Pesanan, SesiKas } from '../types';

export interface Rekap {
  penjualanTunai: number;
  penjualanQris: number;
  penjualanTotal: number;
  jumlahPesanan: number;
  pengeluaranPerKategori: Record<KategoriPengeluaran, number>;
  pengeluaranTotal: number;
  koreksiTotal: number;
  perkiraanLaba: number;
  perHari: { tanggal: string; penjualan: number; pengeluaran: number }[];
  menuTerlaris: { nama: string; porsi: number; rupiah: number }[];
}

export interface Peringatan {
  jenis: 'batal_pesanan' | 'batal_pengeluaran' | 'selisih_tunai' | 'selisih_qris' | 'modal_diubah' | 'tutup_tidak_cocok'
    | 'pesanan_tidak_wajar' | 'kas_terlalu_lama';
  waktu: Date;
  pesan: string;
  refId: string;
}

const SEMUA_KATEGORI: KategoriPengeluaran[] = [
  'Bahan baku', 'Minyak', 'Gas', 'Beras', 'Kemasan', 'Operasional lain',
];

/** Every YYYY-MM-DD from dari to sampai inclusive, via UTC arithmetic on the string. */
function rentangTanggal(dari: string, sampai: string): string[] {
  const out: string[] = [];
  const t = new Date(`${dari}T00:00:00Z`);
  const akhir = new Date(`${sampai}T00:00:00Z`).getTime();
  while (t.getTime() <= akhir) {
    out.push(t.toISOString().slice(0, 10));
    t.setUTCDate(t.getUTCDate() + 1);
  }
  return out;
}

export function rekapPeriode(
  d: { pesanan: Pesanan[]; pengeluaran: Pengeluaran[]; koreksi: Koreksi[] },
  dari: string,
  sampai: string,
): Rekap {
  const dalam = (tgl: string) => tgl >= dari && tgl <= sampai;
  const pesanan = d.pesanan.filter((p) => p.status === 'lunas' && dalam(p.tanggal));
  const pengeluaran = d.pengeluaran.filter((e) => e.status === 'aktif' && dalam(e.tanggal));
  const koreksi = d.koreksi.filter((k) => dalam(k.tanggal));

  const penjualanTunai = pesanan.filter((p) => p.caraBayar === 'tunai').reduce((s, p) => s + p.total, 0);
  const penjualanQris = pesanan.filter((p) => p.caraBayar === 'qris').reduce((s, p) => s + p.total, 0);
  const penjualanTotal = penjualanTunai + penjualanQris;

  const pengeluaranPerKategori = Object.fromEntries(SEMUA_KATEGORI.map((k) => [k, 0])) as Record<
    KategoriPengeluaran,
    number
  >;
  for (const e of pengeluaran) pengeluaranPerKategori[e.kategori] += e.nominal;
  const pengeluaranTotal = pengeluaran.reduce((s, e) => s + e.nominal, 0);
  const koreksiTotal = koreksi.reduce((s, k) => s + k.nominal, 0);

  const harian = new Map(rentangTanggal(dari, sampai).map((t) => [t, { tanggal: t, penjualan: 0, pengeluaran: 0 }]));
  for (const p of pesanan) harian.get(p.tanggal)!.penjualan += p.total;
  for (const e of pengeluaran) harian.get(e.tanggal)!.pengeluaran += e.nominal;

  const menu = new Map<string, { nama: string; porsi: number; rupiah: number }>();
  for (const p of pesanan) {
    for (const i of p.item) {
      const m = menu.get(i.nama) ?? { nama: i.nama, porsi: 0, rupiah: 0 };
      m.porsi += i.jumlah;
      m.rupiah += i.harga * i.jumlah;
      menu.set(i.nama, m);
    }
  }

  return {
    penjualanTunai,
    penjualanQris,
    penjualanTotal,
    jumlahPesanan: pesanan.length,
    pengeluaranPerKategori,
    pengeluaranTotal,
    koreksiTotal,
    perkiraanLaba: penjualanTotal - pengeluaranTotal + koreksiTotal,
    perHari: [...harian.values()],
    menuTerlaris: [...menu.values()].sort((a, b) => b.porsi - a.porsi || b.rupiah - a.rupiah),
  };
}

/** Close figures recomputed from the session's own records, beside what the closing phone stored. */
export interface CekSesi {
  tunaiSeharusnya: number;
  tunaiSeharusnyaTersimpan: number;
  /** tunaiDihitung − recomputed tunaiSeharusnya. */
  selisihTunai: number;
  selisihTunaiTersimpan: number;
  qrisAplikasi: number;
  qrisAplikasiTersimpan: number;
  /** qrisMerchant − recomputed QRIS sales. */
  selisihQris: number;
  selisihQrisTersimpan: number;
  jumlahBelumBayar: number;
  /** Stored expected figures match the records and no order was left unpaid. */
  cocok: boolean;
}

/**
 * Ruling R5: tunaiSeharusnya/qrisAplikasi are written by the closing phone and the rules cannot sum,
 * so owner views recompute them from the session's pesanan/pengeluaran (other sessions are ignored).
 */
export function cekSesi(sesi: SesiKas, pesanan: Pesanan[], pengeluaran: Pengeluaran[]): CekSesi {
  // A cancellation made after the close (only the owner can) is undone here, so the recompute shows
  // the state at close time: a paid order counts as lunas, an unpaid one as belum bayar.
  const sesudahTutup = (d: Date | null) => !!d && !!sesi.ditutupPada && d.getTime() > sesi.ditutupPada.getTime();
  const r = ringkasSesi(
    sesi,
    pesanan
      .filter((p) => p.sesiKasId === sesi.id)
      .map((p) => (p.status === 'batal' && sesudahTutup(p.dibatalkanPada)
        ? { ...p, status: p.dilunasiPada ? ('lunas' as const) : ('belum_bayar' as const) }
        : p)),
    pengeluaran
      .filter((e) => e.sesiKasId === sesi.id)
      .map((e) => (e.status === 'batal' && sesudahTutup(e.dibatalkanPada) ? { ...e, status: 'aktif' as const } : e)),
  );
  const tunaiSeharusnyaTersimpan = sesi.tunaiSeharusnya ?? 0;
  const qrisAplikasiTersimpan = sesi.qrisAplikasi ?? 0;
  const dihitung = sesi.tunaiDihitung ?? 0;
  const merchant = sesi.qrisMerchant ?? 0;
  return {
    tunaiSeharusnya: r.tunaiSeharusnya,
    tunaiSeharusnyaTersimpan,
    selisihTunai: dihitung - r.tunaiSeharusnya,
    selisihTunaiTersimpan: sesi.selisihTunai ?? 0,
    qrisAplikasi: r.penjualanQris,
    qrisAplikasiTersimpan,
    selisihQris: merchant - r.penjualanQris,
    selisihQrisTersimpan: sesi.selisihQris ?? 0,
    jumlahBelumBayar: r.jumlahBelumBayar,
    cocok: r.tunaiSeharusnya === tunaiSeharusnyaTersimpan && r.penjualanQris === qrisAplikasiTersimpan
      && r.jumlahBelumBayar === 0,
  };
}

const bulatPositif = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n > 0;

/**
 * The rules can only check the first item of an order, so the owner's view re-adds every order:
 * an item with a bad jumlah/harga, or a total that is not the sum of its items, is flagged.
 */
function cekPesanan(p: Pesanan): string | null {
  const item = Array.isArray(p.item) ? p.item : [];
  if (item.some((i) => !bulatPositif(i?.jumlah) || !bulatPositif(i?.harga))) return 'berisi jumlah/harga tidak valid.';
  const seharusnya = hitungTotal(item);
  if (p.total !== seharusnya) {
    return `total ${formatRupiah(p.total)} tidak sesuai isi pesanan (${formatRupiah(seharusnya)}).`;
  }
  return null;
}

/** An open drawer older than this, or dated before yesterday (WIB), was probably never closed. */
const BATAS_JAM_BUKA = 20;

export function daftarPeringatan(d: {
  sesi: SesiKas[];
  pesanan: Pesanan[];
  pengeluaran: Pengeluaran[];
}, sekarang: Date = new Date()): Peringatan[] {
  const out: Peringatan[] = [];
  const kemarin = tambahHari(tanggalWIB(sekarang), -1);

  for (const s of d.sesi) {
    if (s.status !== 'buka') continue;
    const lama = sekarang.getTime() - s.dibukaPada.getTime() > BATAS_JAM_BUKA * 3600_000;
    if (s.tanggal < kemarin || lama) {
      out.push({
        jenis: 'kas_terlalu_lama',
        waktu: s.dibukaPada,
        refId: s.id,
        pesan: `Kas dibuka sejak ${s.tanggal} ${jamWIB(s.dibukaPada)} oleh ${s.dibukaOleh.nama} dan belum ditutup.`,
      });
    }
  }

  for (const p of d.pesanan) {
    const salah = p.status === 'batal' ? null : cekPesanan(p);
    if (salah) {
      out.push({
        jenis: 'pesanan_tidak_wajar',
        waktu: p.dibuatPada,
        refId: p.id,
        pesan: `Pesanan #${p.nomor} (${p.tanggal}) tidak wajar: ${salah}`,
      });
    }
  }

  for (const p of d.pesanan) {
    if (p.status !== 'batal' || !p.dibatalkanOleh || !p.dibatalkanPada) continue;
    out.push({
      jenis: 'batal_pesanan',
      waktu: p.dibatalkanPada,
      refId: p.id,
      pesan: `Pesanan #${p.nomor} (${formatRupiah(p.total)}) dibatalkan oleh ${p.dibatalkanOleh.nama}: ${p.alasanBatal}`,
    });
  }

  for (const e of d.pengeluaran) {
    if (e.status !== 'batal' || !e.dibatalkanOleh || !e.dibatalkanPada) continue;
    out.push({
      jenis: 'batal_pengeluaran',
      waktu: e.dibatalkanPada,
      refId: e.id,
      pesan: `Pengeluaran ${e.kategori} (${formatRupiah(e.nominal)}) dibatalkan oleh ${e.dibatalkanOleh.nama}: ${e.alasanBatal}`,
    });
  }

  for (const s of d.sesi) {
    if (s.ditutupOleh && s.ditutupPada) {
      const c = cekSesi(s, d.pesanan, d.pengeluaran);
      const dasar = { waktu: s.ditutupPada, refId: s.id };
      const tidakCocok = (angka: 'tunai' | 'QRIS', hitungUlang: number, tersimpan: number) => ({
        ...dasar,
        jenis: 'tutup_tidak_cocok' as const,
        pesan: `Angka tutup kas ${s.tanggal} tidak cocok dengan catatan pesanan (${angka} seharusnya ${formatRupiah(hitungUlang)}, tercatat ${formatRupiah(tersimpan)}).`,
      });
      if (c.tunaiSeharusnya !== c.tunaiSeharusnyaTersimpan) out.push(tidakCocok('tunai', c.tunaiSeharusnya, c.tunaiSeharusnyaTersimpan));
      if (c.qrisAplikasi !== c.qrisAplikasiTersimpan) out.push(tidakCocok('QRIS', c.qrisAplikasi, c.qrisAplikasiTersimpan));
      if (c.jumlahBelumBayar > 0) {
        out.push({
          ...dasar,
          jenis: 'tutup_tidak_cocok',
          pesan: `Kas ${s.tanggal} ditutup dengan ${c.jumlahBelumBayar} pesanan belum bayar.`,
        });
      }
      // Selisih from the recomputed expectation; the stored figure is shown only when it differs.
      const tercatat = (hitung: number, simpan: number) => (hitung === simpan ? '' : `, tercatat ${formatRupiah(simpan)}`);
      if (c.selisihTunai) {
        out.push({
          ...dasar,
          jenis: 'selisih_tunai',
          pesan: `Selisih tunai ${formatRupiah(c.selisihTunai)} di kas ${s.tanggal} (ditutup ${s.ditutupOleh.nama}${tercatat(c.selisihTunai, c.selisihTunaiTersimpan)})`,
        });
      }
      if (c.selisihQris) {
        out.push({
          ...dasar,
          jenis: 'selisih_qris',
          pesan: `Selisih QRIS ${formatRupiah(c.selisihQris)} di kas ${s.tanggal} (ditutup ${s.ditutupOleh.nama}${tercatat(c.selisihQris, c.selisihQrisTersimpan)})`,
        });
      }
    }
    if (s.alasanUbahModal) {
      out.push({
        jenis: 'modal_diubah',
        waktu: s.dibukaPada,
        refId: s.id,
        pesan: `Modal awal diubah dari ${formatRupiah(s.modalSaran)} jadi ${formatRupiah(s.modalAwal)} oleh ${s.dibukaOleh.nama}: ${s.alasanUbahModal}`,
      });
    }
  }

  return out.sort((a, b) => b.waktu.getTime() - a.waktu.getTime());
}

export function keCSV(r: Rekap, _dari: string, _sampai: string): string {
  const baris = ['Tanggal,Penjualan,Pengeluaran'];
  for (const h of r.perHari) baris.push(`${h.tanggal},${h.penjualan},${h.pengeluaran}`);
  baris.push(
    '',
    `Penjualan tunai,${r.penjualanTunai}`,
    `Penjualan QRIS,${r.penjualanQris}`,
    `Pengeluaran,${r.pengeluaranTotal}`,
    `Koreksi,${r.koreksiTotal}`,
    `Perkiraan laba,${r.perkiraanLaba}`,
  );
  return baris.join('\n');
}
