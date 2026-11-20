import { useEffect, useState } from 'react';
import { Check, Printer as IkonPrinter, RefreshCw } from 'lucide-react';
import {
  aturCetakOtomatis, cariPrinter, cetakOtomatis, cetakTes, printerTersedia, printerTersimpan, simpanPrinter,
  type Printer,
} from '../printer/printer';
import { pesanGalat } from './galat';
import Tombol from './komponen/Tombol';

/** Printer settings, open to every user from the gear icon in the header. */
export default function PengaturanPrinter({ namaWarung }: { namaWarung: string }) {
  const native = printerTersedia();
  const [daftar, setDaftar] = useState<Printer[] | null>(null);
  const [mencari, setMencari] = useState(false);
  const [dipilih, setDipilih] = useState<string | null>(() => printerTersimpan());
  const [otomatis, setOtomatis] = useState(() => cetakOtomatis());
  const [galat, setGalat] = useState<string | null>(null);
  const [kabar, setKabar] = useState<string | null>(null);
  const [cariKe, setCariKe] = useState(0);

  useEffect(() => {
    if (!native) return;
    let batal = false;
    setMencari(true);
    setGalat(null);
    cariPrinter()
      .then((d) => { if (!batal) setDaftar(d); }, (e) => { if (!batal) setGalat(pesanGalat(e)); })
      .finally(() => { if (!batal) setMencari(false); });
    return () => { batal = true; };
  }, [native, cariKe]);

  function pilih(alamat: string) {
    simpanPrinter(alamat);
    setDipilih(alamat);
    setKabar(null);
  }

  function ubahOtomatis(aktif: boolean) {
    aturCetakOtomatis(aktif);
    setOtomatis(aktif);
  }

  async function tes() {
    setGalat(null);
    setKabar(null);
    try {
      await cetakTes(namaWarung);
      setKabar(native ? 'Struk tes terkirim ke printer.' : 'Jendela cetak sudah dibuka.');
    } catch (e) {
      setGalat(pesanGalat(e));
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-3">
      <h2 className="text-2xl font-bold text-stone-900">Printer Struk</h2>

      {!native && (
        <div className="rounded-xl border-2 border-stone-300 bg-white p-3 text-base text-stone-800">
          <p className="font-semibold">Cetak lewat Bluetooth hanya bisa di aplikasi Android Warung.</p>
          <p className="mt-1">Di browser ini, struk dicetak lewat jendela cetak browser.</p>
        </div>
      )}

      {native && (
        <section className="flex flex-col gap-2">
          <h3 className="text-lg font-bold text-stone-900">Pilih printer</h3>
          <p className="text-base text-stone-700">Printer belum muncul? Pasangkan dulu di Pengaturan Bluetooth HP, lalu cari lagi.</p>
          {mencari && <p role="status" className="text-base text-stone-700">Mencari printer…</p>}
          {daftar && daftar.length === 0 && !mencari && (
            <p className="rounded-xl bg-white p-3 text-base text-stone-800">Belum ada perangkat Bluetooth yang dipasangkan.</p>
          )}
          {daftar && daftar.length > 0 && (
            <div role="radiogroup" aria-label="Printer" className="flex flex-col gap-2">
              {daftar.map((p) => {
                const aktif = dipilih === p.alamat;
                return (
                  <label key={p.alamat}
                    className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 bg-white px-3 py-2 ${
                      aktif ? 'border-orange-700 bg-orange-50' : 'border-stone-300'
                    }`}>
                    <input type="radio" name="printer" value={p.alamat} checked={aktif} onChange={() => pilih(p.alamat)}
                      className="size-5 accent-orange-700" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-semibold text-stone-900">{p.nama}</span>
                      <span className="block text-sm text-stone-700">{p.alamat}</span>
                    </span>
                    {aktif && <Check aria-hidden className="size-6 shrink-0 text-orange-700" />}
                  </label>
                );
              })}
            </div>
          )}
          <Tombol jenis="kedua" disabled={mencari} onClick={() => setCariKe((n) => n + 1)}>
            <span className="flex items-center justify-center gap-2"><RefreshCw aria-hidden className="size-5" />Cari printer lagi</span>
          </Tombol>
        </section>
      )}

      <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-stone-300 bg-white px-3 py-2">
        <input type="checkbox" checked={otomatis} onChange={(e) => ubahOtomatis(e.target.checked)} className="size-6 accent-orange-700" />
        <span className="flex-1">
          <span className="block text-lg font-semibold text-stone-900">Cetak struk otomatis</span>
          <span className="block text-sm text-stone-700">Langsung cetak setiap kali pesanan lunas.</span>
        </span>
      </label>

      {galat && <p role="alert" className="text-base font-medium text-red-800">{galat}</p>}
      {kabar && <p role="status" className="rounded-xl bg-green-800 p-3 text-center text-base font-medium text-white">{kabar}</p>}

      <Tombol onClick={tes} className="min-h-14">
        <span className="flex items-center justify-center gap-2"><IkonPrinter aria-hidden className="size-5" />Cetak tes</span>
      </Tombol>
    </div>
  );
}
