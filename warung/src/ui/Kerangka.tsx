import type { ReactNode } from 'react';
import { ClipboardList, Home, LogOut, Menu as IkonMenu, Settings, ShoppingCart, Vault, Wallet, type LucideIcon } from 'lucide-react';
import type { Peran, Pengguna } from '../types';

/** 'printer' has no bottom-nav button: it opens from the gear icon in the header. */
export type Tab = 'beranda' | 'kasir' | 'pesanan' | 'pengeluaran' | 'tutup' | 'lainnya' | 'printer';

// Owner: 5 tabs (Pengeluaran lives in Lainnya) so every label fits at 360px. Karyawan: 4 tabs.
const TAB: { id: Tab; teks: string; Ikon: LucideIcon; untuk?: Peran }[] = [
  { id: 'beranda', teks: 'Beranda', Ikon: Home, untuk: 'pemilik' },
  { id: 'kasir', teks: 'Kasir', Ikon: ShoppingCart },
  { id: 'pesanan', teks: 'Pesanan', Ikon: ClipboardList },
  { id: 'pengeluaran', teks: 'Pengeluaran', Ikon: Wallet, untuk: 'karyawan' },
  { id: 'tutup', teks: 'Tutup Kas', Ikon: Vault },
  { id: 'lainnya', teks: 'Lainnya', Ikon: IkonMenu, untuk: 'pemilik' },
];

export const daftarTab = (peran: Peran) => TAB.filter((t) => !t.untuk || t.untuk === peran);
export const tabAwal = (peran: Peran): Tab => (peran === 'pemilik' ? 'beranda' : 'kasir');

interface Props {
  namaWarung: string;
  pengguna: Pengguna;
  tab: Tab;
  onTab(t: Tab): void;
  onKeluar(): void;
  children: ReactNode;
}

/** Header + scrolling content + bottom nav. */
export default function Kerangka({ namaWarung, pengguna, tab, onTab, onKeluar, children }: Props) {
  return (
    <div className="mx-auto flex h-dvh max-w-lg flex-col bg-stone-100">
      <header className="flex items-center justify-between gap-2 bg-stone-900 px-3 py-1 text-white">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-tight">{namaWarung}</p>
          <p className="truncate text-sm text-stone-300">{pengguna.nama}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => onTab('printer')} aria-label="Pengaturan Printer" title="Pengaturan Printer"
            aria-current={tab === 'printer' ? 'page' : undefined}
            className={`flex size-12 items-center justify-center rounded-xl active:bg-stone-700 ${tab === 'printer' ? 'bg-stone-700' : ''}`}>
            <Settings aria-hidden className="size-6" />
          </button>
          <button type="button" onClick={onKeluar} className="flex min-h-12 items-center gap-1 rounded-xl px-3 text-base active:bg-stone-700">
            <LogOut aria-hidden className="size-5" /> Keluar
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">{children}</main>
      <nav className="flex border-t border-stone-300 bg-white">
        {daftarTab(pengguna.peran).map(({ id, teks, Ikon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-xs font-semibold ${
              tab === id ? 'text-orange-700' : 'text-stone-600'
            }`}
          >
            <Ikon aria-hidden className="size-6" />
            <span className="w-full truncate text-center">{teks}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
