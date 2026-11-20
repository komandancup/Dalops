import type { ReactNode } from 'react';
import {
  Ban, BarChart3, ChevronLeft, ChevronRight, History, Receipt, Settings, UtensilsCrossed, Users, Wallet, type LucideIcon,
} from 'lucide-react';
import type { Pengguna } from '../../types';
import Karyawan from './Karyawan';
import KelolaMenu from './KelolaMenu';
import Pembatalan from './Pembatalan';
import PengaturanWarung from './PengaturanWarung';
import PengeluaranPemilik from './PengeluaranPemilik';
import Rekap from './Rekap';
import RiwayatKas from './RiwayatKas';

export type Halaman =
  | 'menu' | 'rekap' | 'riwayat' | 'pembatalan' | 'pengeluaranKas' | 'pengeluaranPemilik' | 'kelolaMenu' | 'karyawan' | 'pengaturan';

/** A screen inside Lainnya, optionally focused on one record (from a tapped Beranda alert). */
export interface Tujuan {
  halaman: Halaman;
  fokus?: { id: string; tanggal: string };
}

const MENU: { halaman: Exclude<Halaman, 'menu'>; judul: string; keterangan: string; Ikon: LucideIcon }[] = [
  { halaman: 'rekap', judul: 'Rekap', keterangan: 'Penjualan, pengeluaran dan laba per periode', Ikon: BarChart3 },
  { halaman: 'riwayat', judul: 'Riwayat Kas', keterangan: 'Buka dan tutup kas, selisih, koreksi', Ikon: History },
  { halaman: 'pembatalan', judul: 'Pembatalan', keterangan: 'Pesanan dan pengeluaran yang dibatalkan', Ikon: Ban },
  { halaman: 'pengeluaranKas', judul: 'Pengeluaran', keterangan: 'Catat pengeluaran kas yang sedang buka', Ikon: Wallet },
  { halaman: 'pengeluaranPemilik', judul: 'Pengeluaran Pemilik', keterangan: 'Belanja yang dibayar pakai uang Anda sendiri', Ikon: Receipt },
  { halaman: 'kelolaMenu', judul: 'Kelola Menu', keterangan: 'Harga dan daftar makanan', Ikon: UtensilsCrossed },
  { halaman: 'karyawan', judul: 'Karyawan', keterangan: 'Akun karyawan', Ikon: Users },
  { halaman: 'pengaturan', judul: 'Pengaturan', keterangan: 'Nama warung dan QRIS', Ikon: Settings },
];

interface Props {
  pengguna: Pengguna;
  tujuan: Tujuan;
  onTujuan(t: Tujuan): void;
  /** Renders the session expense screen (it needs App's open-session listener). */
  pengeluaranKas(): ReactNode;
}

/** Owner's "more" tab: a menu of the less frequent screens. */
export default function Lainnya({ pengguna, tujuan, onTujuan, pengeluaranKas }: Props) {
  if (tujuan.halaman === 'menu') {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-2 p-4">
        <h2 className="text-2xl font-bold text-stone-900">Lainnya</h2>
        <ul className="flex flex-col gap-2">
          {MENU.map(({ halaman, judul, keterangan, Ikon }) => (
            <li key={halaman}>
              <button type="button" onClick={() => onTujuan({ halaman })}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 text-left active:bg-stone-100">
                <Ikon aria-hidden className="size-6 shrink-0 text-orange-700" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-lg font-semibold text-stone-900">{judul}</span>
                  <span className="text-sm text-stone-700">{keterangan}</span>
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-stone-500" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  let isi: ReactNode;
  // Keyed by the focus so a second alert tap re-applies its range and highlight.
  const kunci = tujuan.fokus?.id ?? '';
  if (tujuan.halaman === 'rekap') isi = <Rekap />;
  else if (tujuan.halaman === 'riwayat') isi = <RiwayatKas key={kunci} pengguna={pengguna} fokus={tujuan.fokus} />;
  else if (tujuan.halaman === 'pembatalan') isi = <Pembatalan key={kunci} fokus={tujuan.fokus} />;
  else if (tujuan.halaman === 'pengeluaranKas') isi = pengeluaranKas();
  else if (tujuan.halaman === 'pengeluaranPemilik') isi = <PengeluaranPemilik pengguna={pengguna} />;
  else if (tujuan.halaman === 'kelolaMenu') isi = <KelolaMenu />;
  else if (tujuan.halaman === 'karyawan') isi = <Karyawan />;
  else isi = <PengaturanWarung />;

  return (
    <div>
      <button type="button" onClick={() => onTujuan({ halaman: 'menu' })}
        className="flex min-h-12 items-center gap-1 px-3 text-base font-semibold text-orange-800 active:bg-stone-200">
        <ChevronLeft aria-hidden className="size-5" /> Kembali
      </button>
      {isi}
    </div>
  );
}
