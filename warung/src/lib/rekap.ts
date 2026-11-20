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
  jenis: 'batal_pesanan' | 'batal_pengeluaran' | 'selisih_tunai' | 'selisih_qris' | 'modal_diubah';
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

export function daftarPeringatan(d: {
  sesi: SesiKas[];
  pesanan: Pesanan[];
  pengeluaran: Pengeluaran[];
}): Peringatan[] {
  const out: Peringatan[] = [];

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
      if (s.selisihTunai) {
        out.push({
          jenis: 'selisih_tunai',
          waktu: s.ditutupPada,
          refId: s.id,
          pesan: `Selisih tunai ${formatRupiah(s.selisihTunai)} di kas ${s.tanggal} (ditutup ${s.ditutupOleh.nama})`,
        });
      }
      if (s.selisihQris) {
        out.push({
          jenis: 'selisih_qris',
          waktu: s.ditutupPada,
          refId: s.id,
          pesan: `Selisih QRIS ${formatRupiah(s.selisihQris)} di kas ${s.tanggal} (ditutup ${s.ditutupOleh.nama})`,
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
