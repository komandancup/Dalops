import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react';
import { db } from '../../firebase';
import { pantauMenu, simpanMenu } from '../../data/menu';
import { formatRupiah } from '../../lib/uang';
import type { KategoriMenu, Menu } from '../../types';
import { pesanGalat } from '../galat';
import Dialog from '../komponen/Dialog';
import Kolom from '../komponen/Kolom';
import InputRupiah from '../komponen/InputRupiah';
import Tombol from '../komponen/Tombol';
import { LayarGalat, LayarMemuat } from '../Status';
import { usePantau } from '../usePantau';

const KATEGORI: KategoriMenu[] = ['Makanan', 'Nasi & Tambahan', 'Minuman'];

/** Placeholders the owner edits; urutan is the position in this list. */
const CONTOH: Omit<Menu, 'id' | 'urutan' | 'aktif'>[] = [
  { nama: 'Pecel Lele', harga: 15000, kategori: 'Makanan' },
  { nama: 'Ayam Penyet', harga: 18000, kategori: 'Makanan' },
  { nama: 'Nasi Putih', harga: 5000, kategori: 'Nasi & Tambahan' },
  { nama: 'Tahu/Tempe', harga: 2000, kategori: 'Nasi & Tambahan' },
  { nama: 'Es Teh', harga: 4000, kategori: 'Minuman' },
  { nama: 'Teh Hangat', harga: 3000, kategori: 'Minuman' },
  { nama: 'Es Jeruk', harga: 6000, kategori: 'Minuman' },
];

/**
 * Moves `id` one step up/down among the items of its own category, then renumbers the whole list 1..n
 * (so duplicate or gapped urutan values heal). Returns only the items whose urutan changed.
 */
export function geserMenu(semua: Menu[], id: string, arah: -1 | 1): Menu[] {
  const urut = [...semua];
  const i = urut.findIndex((m) => m.id === id);
  if (i < 0) return [];
  let j = i + arah;
  while (j >= 0 && j < urut.length && urut[j].kategori !== urut[i].kategori) j += arah;
  if (j < 0 || j >= urut.length) return [];
  [urut[i], urut[j]] = [urut[j], urut[i]];
  const lama = new Map(semua.map((m) => [m.id, m.urutan]));
  return urut.map((m, n) => ({ ...m, urutan: n + 1 })).filter((m) => m.urutan !== lama.get(m.id));
}

export default function KelolaMenu() {
  const menu = usePantau<Menu[]>((cb, onError) => pantauMenu(db, cb, onError), 'menu');
  const [form, setForm] = useState<Menu | 'baru' | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  async function jalankan(kerja: () => Promise<void>) {
    setGalat(null);
    try {
      await kerja();
    } catch (e) {
      setGalat(pesanGalat(e));
    }
  }

  if (menu.galat) return <LayarGalat pesan={menu.galat} onCobaLagi={menu.cobaLagi} />;
  if (!menu.data) return <LayarMemuat />;
  const semua = menu.data;
  const urutanBaru = semua.reduce((n, m) => Math.max(n, m.urutan), 0) + 1;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h2 className="text-2xl font-bold text-stone-900">Kelola Menu</h2>
      {galat && <p role="alert" className="text-base font-medium text-red-800">{galat}</p>}

      {semua.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-lg text-stone-800">Menu masih kosong. Isi contoh dulu, lalu ubah nama dan harganya sesuai warung Anda.</p>
          <Tombol onClick={() => jalankan(async () => {
            for (const [n, c] of CONTOH.entries()) await simpanMenu(db, { ...c, aktif: true, urutan: n + 1 });
          })}>Isi contoh menu</Tombol>
        </div>
      ) : (
        KATEGORI.map((k) => {
          const isi = semua.filter((m) => m.kategori === k);
          if (isi.length === 0) return null;
          return (
            <section key={k} className="flex flex-col gap-2">
              <h3 className="text-lg font-bold text-stone-900">{k}</h3>
              <ul className="flex flex-col gap-2">
                {isi.map((m, n) => (
                  <li key={m.id} className={`flex items-center gap-1 rounded-xl border border-stone-200 p-2 ${m.aktif ? 'bg-white' : 'bg-stone-100'}`}>
                    <div className="flex min-w-0 flex-1 flex-col pl-1">
                      <span className={`truncate text-lg font-semibold ${m.aktif ? 'text-stone-900' : 'text-stone-600'}`}>{m.nama}</span>
                      <span className="text-base text-stone-800">
                        {formatRupiah(m.harga)}{!m.aktif && <span className="ml-2 font-semibold text-red-800">Tidak dijual</span>}
                      </span>
                    </div>
                    <TombolIkon label={`Naikkan ${m.nama}`} disabled={n === 0}
                      onClick={() => jalankan(() => simpanBanyak(geserMenu(semua, m.id, -1)))}><ArrowUp aria-hidden /></TombolIkon>
                    <TombolIkon label={`Turunkan ${m.nama}`} disabled={n === isi.length - 1}
                      onClick={() => jalankan(() => simpanBanyak(geserMenu(semua, m.id, 1)))}><ArrowDown aria-hidden /></TombolIkon>
                    <TombolIkon label={`Ubah ${m.nama}`} onClick={() => setForm(m)}><Pencil aria-hidden /></TombolIkon>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <Tombol onClick={() => setForm('baru')} jenis="kedua" className="flex items-center justify-center gap-2">
        <Plus aria-hidden className="size-5" /> Tambah Menu
      </Tombol>

      {form && (
        <FormMenu
          awal={form === 'baru' ? null : form}
          urutanBaru={urutanBaru}
          onTutup={() => setForm(null)}
        />
      )}
    </div>
  );
}

async function simpanBanyak(daftar: Menu[]) {
  for (const m of daftar) await simpanMenu(db, m);
}

function TombolIkon({ label, onClick, disabled, children }: { label: string; onClick(): void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled}
      className="flex size-12 shrink-0 items-center justify-center rounded-xl text-stone-800 active:bg-stone-200 disabled:opacity-30">
      {children}
    </button>
  );
}

function FormMenu({ awal, urutanBaru, onTutup }: { awal: Menu | null; urutanBaru: number; onTutup(): void }) {
  const [nama, setNama] = useState(awal?.nama ?? '');
  const [harga, setHarga] = useState<number | null>(awal?.harga ?? null);
  const [kategori, setKategori] = useState<KategoriMenu>(awal?.kategori ?? 'Makanan');
  const [aktif, setAktif] = useState(awal?.aktif ?? true);
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const siap = nama.trim() !== '' && !!harga;

  async function simpan() {
    if (!siap) return;
    setGalat(null);
    setMenyimpan(true);
    try {
      await simpanMenu(db, { id: awal?.id, nama, harga: harga!, kategori, aktif, urutan: awal?.urutan ?? urutanBaru });
      onTutup();
    } catch (e) {
      setGalat(pesanGalat(e));
      setMenyimpan(false);
    }
  }

  return (
    <Dialog judul={awal ? 'Ubah Menu' : 'Tambah Menu'} onTutup={onTutup} kunci={menyimpan}>
      <div className="flex flex-col gap-4">
        <Kolom label="Nama" value={nama} onChange={setNama} autoComplete="off" />
        <InputRupiah label="Harga" value={harga} onChange={setHarga} />
        <div role="group" aria-label="Kategori" className="flex flex-col gap-1">
          <p className="text-base font-medium text-stone-800">Kategori</p>
          <div className="grid grid-cols-1 gap-2">
            {KATEGORI.map((k) => (
              <button key={k} type="button" aria-pressed={kategori === k} onClick={() => setKategori(k)}
                className={`min-h-12 rounded-xl border-2 px-2 text-base font-semibold ${
                  kategori === k ? 'border-orange-700 bg-orange-50 text-orange-900' : 'border-stone-300 bg-white text-stone-900'
                }`}>
                {k}
              </button>
            ))}
          </div>
        </div>
        <button type="button" role="switch" aria-checked={aktif} aria-label="Aktif" onClick={() => setAktif((v) => !v)}
          className="flex min-h-14 items-center justify-between gap-3 rounded-xl border-2 border-stone-300 bg-white px-3 text-left">
          <span className="flex flex-col">
            <span className="text-base font-medium text-stone-800">Aktif</span>
            <span className="text-sm text-stone-700">{aktif ? 'Muncul di Kasir.' : 'Tidak muncul di Kasir.'}</span>
          </span>
          <span className={`flex h-8 w-14 shrink-0 items-center rounded-full p-1 ${aktif ? 'justify-end bg-orange-700' : 'justify-start bg-stone-400'}`}>
            <span className="size-6 rounded-full bg-white" />
          </span>
        </button>
        {galat && <p role="alert" className="text-base font-medium text-red-800">{galat}</p>}
        <Tombol onClick={simpan} disabled={!siap} className="min-h-14 text-xl">Simpan Menu</Tombol>
      </div>
    </Dialog>
  );
}
