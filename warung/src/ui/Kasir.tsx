import { useEffect, useState } from 'react';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { db } from '../firebase';
import { pantauMenu } from '../data/menu';
import { buatPesanan } from '../data/pesanan';
import { formatRupiah } from '../lib/uang';
import { cetakOtomatis, cetakPesanan } from '../printer/printer';
import type { KategoriMenu, Menu, Pengguna, SesiKas } from '../types';
import Bayar, { type DataBayar } from './Bayar';
import { pesanGalat } from './galat';
import Dialog from './komponen/Dialog';
import Tombol from './komponen/Tombol';
import { useKeranjang } from './useKeranjang';
import { LayarGalat, LayarMemuat } from './Status';

const KATEGORI: KategoriMenu[] = ['Makanan', 'Nasi & Tambahan', 'Minuman'];

interface Props { pengguna: Pengguna; sesi: SesiKas; namaWarung: string }

export default function Kasir({ pengguna, sesi, namaWarung }: Props) {
  const [menu, setMenu] = useState<Menu[] | null>(null);
  const [galatMenu, setGalatMenu] = useState<string | null>(null);
  const [muatKe, setMuatKe] = useState(0);
  const k = useKeranjang();
  const [layar, setLayar] = useState<'menu' | 'keranjang' | 'bayar'>('menu');
  const [galat, setGalat] = useState<string | null>(null);
  const [kabar, setKabar] = useState<string | null>(null);
  const [galatCetak, setGalatCetak] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    setGalatMenu(null);
    return pantauMenu(db, setMenu, (e) => setGalatMenu(pesanGalat(e)));
  }, [muatKe]);

  useEffect(() => {
    if (!kabar) return;
    const t = setTimeout(() => setKabar(null), 4000);
    return () => clearTimeout(t);
  }, [kabar]);

  useEffect(() => {
    if (k.baris.length === 0 && layar !== 'menu') setLayar('menu');
  }, [k.baris.length, layar]);

  async function simpan(bayar: DataBayar | null) {
    const p = await buatPesanan(db, { uid: pengguna.uid, nama: pengguna.nama }, sesi.id, k.baris, {
      label: k.label.trim(), catatan: k.catatan.trim(), bayar,
    });
    k.kosongkan();
    setLayar('menu');
    setGalatCetak(null);
    setKabar(`Pesanan #${p.nomor} tersimpan, ${bayar ? 'lunas' : 'belum bayar'}.`);
    // The order is already saved: a printer failure is only reported, never undoes the payment.
    if (bayar && cetakOtomatis()) cetakPesanan(p, namaWarung).catch((e) => setGalatCetak(pesanGalat(e)));
  }

  async function simpanNanti() {
    setGalat(null);
    setMenyimpan(true);
    try {
      await simpan(null);
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setMenyimpan(false);
    }
  }

  if (galatMenu) return <LayarGalat pesan={galatMenu} onCobaLagi={() => setMuatKe((n) => n + 1)} />;
  if (menu === null) return <LayarMemuat />;

  const aktif = menu.filter((m) => m.aktif);
  const jumlahDi = (id: string) => k.baris.find((b) => b.menu.id === id)?.jumlah ?? 0;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 p-3 pb-6">
        {aktif.length === 0 && <p className="p-4 text-center text-lg text-stone-700">Belum ada menu aktif. Minta pemilik mengisi menu.</p>}
        {KATEGORI.map((kat) => {
          const isi = aktif.filter((m) => m.kategori === kat);
          if (isi.length === 0) return null;
          return (
            <section key={kat} className="mb-4">
              <h2 className="mb-2 text-base font-bold uppercase tracking-wide text-stone-700">{kat}</h2>
              <div className="grid grid-cols-2 gap-2">
                {isi.map((m) => {
                  const n = jumlahDi(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => k.tambah(m)}
                      className={`relative flex min-h-20 flex-col items-start justify-between rounded-xl border-2 p-3 text-left active:scale-[0.98] ${
                        n > 0 ? 'border-orange-700 bg-orange-50' : 'border-stone-200 bg-white'
                      }`}
                    >
                      <span className={`${n > 0 ? 'pr-8 ' : ''}text-lg font-semibold leading-tight text-stone-900`}>{m.nama}</span>
                      <span className="text-base text-stone-700">{formatRupiah(m.harga)}</span>
                      {n > 0 && (
                        <span className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-orange-700 text-base font-bold text-white">
                          {n}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {(kabar || galatCetak) && (
        <div className="sticky bottom-20 mx-3 mb-2 flex flex-col gap-2">
          {kabar && <p role="status" className="rounded-xl bg-green-800 p-3 text-center text-base font-medium text-white">{kabar}</p>}
          {galatCetak && (
            <p role="alert" className="rounded-xl border-2 border-red-300 bg-white p-3 text-center text-base font-medium text-red-800">
              {galatCetak}
            </p>
          )}
        </div>
      )}

      {k.jumlahItem > 0 && (
        <div className="sticky bottom-0 border-t border-stone-200 bg-stone-100 p-3">
          <button
            type="button"
            onClick={() => {
              setGalat(null);
              setLayar('keranjang');
            }}
            className="flex min-h-14 w-full items-center justify-between rounded-xl bg-orange-700 px-4 text-white active:bg-orange-800"
          >
            <span className="flex items-center gap-3">
              <ShoppingBag aria-hidden className="size-6 shrink-0" />
              <span className="flex flex-col items-start leading-tight">
                <span className="text-sm">{k.jumlahItem} item</span>
                <span className="whitespace-nowrap text-xl font-bold">{formatRupiah(k.total)}</span>
              </span>
            </span>
            <span className="whitespace-nowrap text-base font-semibold">Lihat pesanan ›</span>
          </button>
        </div>
      )}

      {layar === 'keranjang' && (
        <Dialog judul="Pesanan" onTutup={() => setLayar('menu')} kunci={menyimpan}>
          <ul className="mb-4 divide-y divide-stone-200">
            {k.baris.map((b) => (
              <li key={b.menu.id} className="flex items-center gap-2 py-2">
                <div className="flex-1">
                  <p className="text-lg font-semibold text-stone-900">{b.menu.nama}</p>
                  <p className="text-sm text-stone-700">{formatRupiah(b.menu.harga * b.jumlah)}</p>
                </div>
                <button type="button" aria-label={`Kurangi ${b.menu.nama}`} onClick={() => k.kurang(b.menu.id)}
                  className="flex size-12 items-center justify-center rounded-full border-2 border-stone-300 bg-white active:bg-stone-100">
                  <Minus aria-hidden />
                </button>
                <span className="w-8 text-center text-xl font-bold">{b.jumlah}</span>
                <button type="button" aria-label={`Tambah ${b.menu.nama}`} onClick={() => k.tambah(b.menu)}
                  className="flex size-12 items-center justify-center rounded-full border-2 border-stone-300 bg-white active:bg-stone-100">
                  <Plus aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <div className="mb-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-base font-medium text-stone-800">
              Label
              <input value={k.label} onChange={(e) => k.setLabel(e.target.value)} placeholder="mis. Meja 3, Bungkus Pak Budi"
                className="min-h-12 rounded-xl border-2 border-stone-300 bg-white px-3 text-lg font-normal outline-none focus:border-orange-700" />
            </label>
            <label className="flex flex-col gap-1 text-base font-medium text-stone-800">
              Catatan
              <textarea value={k.catatan} onChange={(e) => k.setCatatan(e.target.value)} rows={2} placeholder="mis. sambal dipisah"
                className="rounded-xl border-2 border-stone-300 bg-white px-3 py-2 text-lg font-normal outline-none focus:border-orange-700" />
            </label>
          </div>
          <div className="mb-4 flex items-baseline justify-between">
            <span className="text-lg text-stone-700">Total</span>
            <span className="text-3xl font-extrabold text-stone-900">{formatRupiah(k.total)}</span>
          </div>
          {galat && <p role="alert" className="mb-3 text-base font-medium text-red-800">{galat}</p>}
          <div className="flex flex-col gap-3">
            <Tombol onClick={() => setLayar('bayar')} disabled={menyimpan} className="min-h-14 text-xl">Bayar Sekarang</Tombol>
            <Tombol onClick={simpanNanti} jenis="kedua">Simpan, Bayar Nanti</Tombol>
          </div>
        </Dialog>
      )}

      {layar === 'bayar' && <Bayar total={k.total} onBayar={simpan} onTutup={() => setLayar('keranjang')} />}
    </div>
  );
}
