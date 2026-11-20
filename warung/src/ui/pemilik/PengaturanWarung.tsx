import { useEffect, useId, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { db } from '../../firebase';
import { ambilPengaturan, simpanPengaturan } from '../../data/pengaturan';
import { bacaQrDariFile } from '../../lib/bacaQrGambar';
import { qrisDinamis, validasiQris } from '../../lib/qris';
import { formatRupiah } from '../../lib/uang';
import type { Pengaturan } from '../../types';
import { pesanGalat } from '../galat';
import Kolom from '../komponen/Kolom';
import Tombol from '../komponen/Tombol';
import { LayarGalat, LayarMemuat } from '../Status';

const NOMINAL_UJI = 1000;

export default function PengaturanWarung() {
  const [awal, setAwal] = useState<Pengaturan | undefined>(undefined);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [muatKe, setMuatKe] = useState(0);

  useEffect(() => {
    let batal = false;
    setAwal(undefined);
    setGalatMuat(null);
    ambilPengaturan(db).then((p) => { if (!batal) setAwal(p); }, (e) => { if (!batal) setGalatMuat(pesanGalat(e)); });
    return () => { batal = true; };
  }, [muatKe]);

  if (galatMuat) return <LayarGalat pesan={galatMuat} onCobaLagi={() => setMuatKe((n) => n + 1)} />;
  if (!awal) return <LayarMemuat />;
  return <Isi awal={awal} />;
}

function Isi({ awal }: { awal: Pengaturan }) {
  const idFoto = useId();
  const [nama, setNama] = useState(awal.namaWarung);
  const [kode, setKode] = useState(awal.qrisStatis ?? '');
  const [info, setInfo] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [kabar, setKabar] = useState<string | null>(null);
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  const bersih = kode.trim();
  const hasil = bersih === '' ? null : validasiQris(bersih);
  const qrisValid = hasil?.valid === true;
  const namaBersih = nama.trim();
  // An empty code clears QRIS; a non-empty one must be valid.
  const siap = namaBersih !== '' && (bersih === '' || qrisValid);

  useEffect(() => {
    if (!qrisValid) {
      setPratinjau(null);
      return;
    }
    let batal = false;
    QRCode.toDataURL(qrisDinamis(bersih, NOMINAL_UJI), { width: 480, margin: 2, errorCorrectionLevel: 'M' })
      .then((src) => { if (!batal) setPratinjau(src); }, () => { if (!batal) setPratinjau(null); });
    return () => { batal = true; };
  }, [qrisValid, bersih]);

  async function pilihFoto(f: File | undefined) {
    if (!f) return;
    setInfo(null);
    setKabar(null);
    try {
      const teks = await bacaQrDariFile(f);
      if (teks === null) setInfo('Kode QR tidak terbaca di gambar itu. Coba foto lebih dekat dan terang, atau tempel kodenya.');
      else setKode(teks.trim());
    } catch {
      setInfo('Gambar tidak bisa dibuka. Coba gambar lain, atau tempel kodenya.');
    } finally {
      if (inputFoto.current) inputFoto.current.value = '';
    }
  }

  async function simpan() {
    if (!siap) return;
    setGalat(null);
    setKabar(null);
    try {
      await simpanPengaturan(db, {
        namaWarung: namaBersih,
        qrisStatis: bersih === '' ? null : bersih,
        namaMerchant: bersih === '' ? null : hasil?.namaMerchant ?? null,
      });
      setKode(bersih);
      setNama(namaBersih);
      setKabar('Pengaturan tersimpan.');
    } catch (e) {
      setGalat(pesanGalat(e));
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h2 className="text-2xl font-bold text-stone-900">Pengaturan Warung</h2>
      <Kolom label="Nama warung" value={nama} onChange={(v) => { setNama(v); setKabar(null); }} autoComplete="off" />

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-bold text-stone-900">QRIS</h3>
        <p className="text-base text-stone-800">Foto atau pilih gambar QRIS warung Anda, atau tempel kodenya.</p>
        <input ref={inputFoto} id={idFoto} type="file" accept="image/*" capture="environment" className="sr-only"
          onChange={(e) => void pilihFoto(e.target.files?.[0])} />
        <label htmlFor={idFoto}
          className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-stone-300 bg-white px-4 py-3 text-lg font-semibold text-stone-900 active:bg-stone-100 has-[:focus-visible]:outline">
          Foto / pilih gambar QRIS
        </label>
        {info && <p role="status" className="text-base font-medium text-red-800">{info}</p>}
        <Kolom label="Tempel kode QRIS" value={kode} onChange={(v) => { setKode(v); setInfo(null); setKabar(null); }}
          autoComplete="off" autoCapitalize="none" spellCheck={false} />
        {hasil && (
          <p role="status" className={`text-base font-semibold ${hasil.valid ? 'text-green-800' : 'text-red-800'}`}>
            {hasil.valid ? `QRIS valid: ${hasil.namaMerchant ?? 'nama toko tidak tertulis'}` : hasil.alasan}
          </p>
        )}
        {pratinjau && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-stone-200 bg-white p-3">
            <p className="text-base font-medium text-stone-800">Uji coba: scan untuk melihat nominal {formatRupiah(NOMINAL_UJI)} (tidak perlu bayar)</p>
            <img src={pratinjau} alt={`Contoh kode QRIS ${formatRupiah(NOMINAL_UJI)}`} className="aspect-square w-full max-w-60" />
          </div>
        )}
      </section>

      {galat && <p role="alert" className="text-base font-medium text-red-800">{galat}</p>}
      {kabar && <p role="status" className="rounded-xl bg-green-800 p-3 text-center text-base font-medium text-white">{kabar}</p>}
      <Tombol onClick={simpan} disabled={!siap} className="min-h-14 text-xl">Simpan Pengaturan</Tombol>
    </div>
  );
}
