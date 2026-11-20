import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { qrisDinamis } from '../lib/qris';
import { formatRupiah } from '../lib/uang';
import { pesanGalat } from './galat';
import Tombol from './komponen/Tombol';

interface Props {
  /** The shop's static QRIS; undefined while settings are loading, null when not set up. */
  statis: string | null | undefined;
  total: number;
  onLunas(): Promise<void>;
  onGantiTunai(): void;
  /** Error from the last save attempt, shown above the buttons. */
  galat: string | null;
}

/** Full-screen dynamic QRIS for the customer to scan, with the amount in large type. */
export default function QrisLayar({ statis, total, onLunas, onGantiTunai, galat }: Props) {
  const [gambar, setGambar] = useState<{ src: string } | { gagal: string } | null>(null);

  useEffect(() => {
    if (!statis) return;
    let batal = false;
    setGambar(null);
    (async () => {
      try {
        const src = await QRCode.toDataURL(qrisDinamis(statis, total), { width: 640, margin: 2, errorCorrectionLevel: 'M' });
        if (!batal) setGambar({ src });
      } catch (e) {
        if (!batal) setGambar({ gagal: pesanGalat(e) });
      }
    })();
    return () => {
      batal = true;
    };
  }, [statis, total]);

  let isi;
  if (statis === undefined) isi = <p className="text-lg text-stone-700">Memuat QRIS…</p>;
  else if (statis === null) {
    isi = <p className="text-xl font-semibold text-red-800">QRIS warung belum diatur. Minta pemilik mengisi di Pengaturan.</p>;
  } else if (gambar === null) isi = <p className="text-lg text-stone-700">Membuat kode QR…</p>;
  else if ('gagal' in gambar) isi = <p className="text-xl font-semibold text-red-800">{gambar.gagal}</p>;
  else isi = <img src={gambar.src} alt={`Kode QRIS ${formatRupiah(total)}`} className="aspect-square w-full max-w-[min(90vw,60vh)]" />;

  return (
    <div role="dialog" aria-modal="true" aria-label="Bayar QRIS" className="fixed inset-0 z-50 flex flex-col items-center gap-4 overflow-y-auto bg-white p-4">
      <p className="text-lg font-medium text-stone-700">Scan QRIS, bayar</p>
      <p className="text-5xl font-extrabold tracking-tight text-stone-900">{formatRupiah(total)}</p>
      <div className="flex w-full flex-1 items-center justify-center text-center">{isi}</div>
      {galat && <p role="alert" className="w-full max-w-lg text-center text-base font-medium text-red-800">{galat}</p>}
      <div className="flex w-full max-w-lg flex-col gap-3">
        <Tombol onClick={onLunas} className="min-h-16 text-xl">Sudah masuk, tandai lunas</Tombol>
        <Tombol onClick={onGantiTunai} jenis="kedua">Ganti ke tunai</Tombol>
      </div>
    </div>
  );
}
