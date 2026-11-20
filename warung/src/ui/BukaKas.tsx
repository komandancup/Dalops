import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { ambilSesiAktif, bukaSesi } from '../data/sesi';
import { formatRupiah } from '../lib/uang';
import type { Pengguna } from '../types';
import { pesanGalat } from './galat';
import InputRupiah from './komponen/InputRupiah';
import Tombol from './komponen/Tombol';
import { LayarGalat, LayarMemuat } from './Status';

/** Shown when no cash session is open. The open session then arrives via pantauSesiAktif. */
export default function BukaKas({ pengguna }: { pengguna: Pengguna }) {
  const [saran, setSaran] = useState<number | null>(null);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [muatKe, setMuatKe] = useState(0);
  const [modal, setModal] = useState<number | null>(null);
  const [alasan, setAlasan] = useState('');
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    setGalatMuat(null);
    ambilSesiAktif(db)
      .then(({ modalSaran }) => {
        if (batal) return;
        setSaran(modalSaran);
        setModal(modalSaran);
      })
      .catch((e) => !batal && setGalatMuat(pesanGalat(e)));
    return () => {
      batal = true;
    };
  }, [muatKe]);

  if (galatMuat) return <LayarGalat pesan={galatMuat} onCobaLagi={() => setMuatKe((n) => n + 1)} />;
  if (saran === null) return <LayarMemuat />;

  const beda = modal !== saran;

  async function buka() {
    if (modal === null) return;
    setGalat(null);
    try {
      await bukaSesi(db, { uid: pengguna.uid, nama: pengguna.nama }, modal, beda ? alasan.trim() : null);
    } catch (e) {
      setGalat(pesanGalat(e));
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <div>
        <h2 className="text-2xl font-bold text-stone-900">Buka kas dulu</h2>
        <p className="text-base text-stone-700">Hitung uang di laci sebelum mulai jualan.</p>
      </div>
      <InputRupiah
        label="Modal awal di laci"
        value={modal}
        onChange={setModal}
        keterangan={`Saran dari tutup kas terakhir: ${formatRupiah(saran)}`}
      />
      {beda && (
        <label className="flex flex-col gap-1 text-base font-medium text-stone-800">
          Alasan
          <input value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="mis. uang kecil ditukar"
            className="min-h-12 rounded-xl border-2 border-stone-300 bg-white px-3 text-lg font-normal outline-none focus:border-orange-700" />
          <span className="text-sm font-normal text-stone-700">Wajib diisi karena modal berbeda dari saran.</span>
        </label>
      )}
      {galat && <p role="alert" className="text-base font-medium text-red-800">{galat}</p>}
      <Tombol onClick={buka} disabled={modal === null || (beda && alasan.trim() === '')} className="min-h-14 text-xl">
        Buka Kas
      </Tombol>
    </div>
  );
}
