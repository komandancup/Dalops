import { useEffect, useState } from 'react';
import { Banknote, QrCode } from 'lucide-react';
import { db } from '../firebase';
import { ambilPengaturan } from '../data/pengaturan';
import { formatRupiah } from '../lib/uang';
import type { CaraBayar } from '../types';
import { pesanGalat } from './galat';
import Dialog from './komponen/Dialog';
import InputRupiah from './komponen/InputRupiah';
import Tombol from './komponen/Tombol';
import QrisLayar from './QrisLayar';

export interface DataBayar { caraBayar: CaraBayar; uangDiterima: number | null }

interface Props {
  total: number;
  /** Dialog title, e.g. "Bayar" for a new cart or "Bayar Pesanan #12" for a saved order. */
  judul?: string;
  /**
   * Records the payment: for a new cart call buatPesanan with `bayar`, for a saved "Belum bayar"
   * order call lunasiPesanan. A rejection is shown here; the caller closes Bayar on success.
   */
  onBayar(bayar: DataBayar): Promise<void>;
  onTutup(): void;
}

export default function Bayar({ total, judul = 'Bayar', onBayar, onTutup }: Props) {
  const [cara, setCara] = useState<CaraBayar | null>(null);
  const [uang, setUang] = useState<number | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [statis, setStatis] = useState<string | null | undefined>(undefined);

  const [galatQris, setGalatQris] = useState<string | null>(null);
  const [muatKe, setMuatKe] = useState(0);

  useEffect(() => {
    let batal = false;
    setGalatQris(null);
    ambilPengaturan(db)
      .then((p) => !batal && setStatis(p.qrisStatis))
      .catch((e) => !batal && setGalatQris(`Gagal memuat QRIS. ${pesanGalat(e)}`));
    return () => {
      batal = true;
    };
  }, [muatKe]);

  const simpan = async (bayar: DataBayar) => {
    setGalat(null);
    try {
      await onBayar(bayar);
    } catch (e) {
      setGalat(pesanGalat(e));
    }
  };
  const pilih = (c: CaraBayar) => {
    setGalat(null);
    setCara(c);
    if (c === 'qris' && galatQris) setMuatKe((n) => n + 1); // retry a failed settings load
  };

  const kurang = uang !== null && uang < total;

  return (
    <>
      <Dialog judul={judul} onTutup={onTutup}>
        <p className="mb-4 text-center text-4xl font-extrabold text-stone-900">{formatRupiah(total)}</p>
        <div className="grid grid-cols-2 gap-3">
          {([['tunai', 'Tunai', Banknote], ['qris', 'QRIS', QrCode]] as const).map(([c, teks, Ikon]) => (
            <button
              key={c}
              type="button"
              aria-pressed={cara === c}
              onClick={() => pilih(c)}
              className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 text-xl font-bold ${
                cara === c ? 'border-orange-700 bg-orange-50 text-orange-900' : 'border-stone-300 bg-white text-stone-900'
              }`}
            >
              <Ikon aria-hidden />
              {teks}
            </button>
          ))}
        </div>
        {cara === 'tunai' && (
          <div className="mt-4 flex flex-col gap-4">
            <InputRupiah
              label="Uang diterima"
              value={uang}
              onChange={setUang}
              keterangan={uang === null ? 'Boleh dikosongkan kalau uangnya pas.' : undefined}
            />
            <div className="flex items-baseline justify-between rounded-xl bg-white p-3">
              <span className="text-lg text-stone-700">{kurang ? 'Uang kurang' : 'Kembalian'}</span>
              <span className={`text-2xl font-bold ${kurang ? 'text-red-800' : 'text-stone-900'}`}>
                {uang === null ? '–' : formatRupiah(Math.abs(uang - total))}
              </span>
            </div>
            {galat && <p role="alert" className="text-base font-medium text-red-800">{galat}</p>}
            <Tombol onClick={() => simpan({ caraBayar: 'tunai', uangDiterima: uang })} disabled={kurang} className="min-h-14 text-xl">
              Simpan Lunas
            </Tombol>
          </div>
        )}
      </Dialog>
      {cara === 'qris' && (
        <QrisLayar
          statis={statis}
          total={total}
          galat={galat ?? galatQris}
          onLunas={() => simpan({ caraBayar: 'qris', uangDiterima: null })}
          onGantiTunai={() => pilih('tunai')}
        />
      )}
    </>
  );
}
