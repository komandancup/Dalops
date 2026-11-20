import { useState } from 'react';
import { db } from '../firebase';
import { pantauPengeluaranSesi } from '../data/pengeluaran';
import { pantauPesananSesi } from '../data/pesanan';
import { tutupSesi } from '../data/sesi';
import { ringkasSesi, validasiTutup } from '../lib/kas';
import { formatRupiah } from '../lib/uang';
import type { Pengeluaran, Pengguna, Pesanan, SesiKas } from '../types';
import { pesanGalat } from './galat';
import InputRupiah from './komponen/InputRupiah';
import Tombol from './komponen/Tombol';
import { KasBelumDibuka, LayarGalat, LayarMemuat } from './Status';
import { usePantau } from './usePantau';

export interface HasilTutup { sesiId: string; disetor: number; ditinggal: number }

/**
 * Close-session screen for the open session (blind count first); after closing it shows what to hand over.
 * The last close result is kept by the parent so the message survives a tab switch.
 */
export default function TutupKas({ pengguna, sesi, hasil, onSelesai }: {
  pengguna: Pengguna; sesi: SesiKas | null; hasil: HasilTutup | null; onSelesai(h: HasilTutup): void;
}) {
  if (hasil && (!sesi || sesi.id === hasil.sesiId)) {
    return (
      <div role="status" className="mx-auto flex max-w-lg flex-col gap-2 p-6 text-center">
        <h2 className="text-2xl font-bold text-stone-900">Kas sudah ditutup.</h2>
        <p className="text-lg text-stone-800">
          Serahkan {formatRupiah(hasil.disetor)} ke pemilik. Tinggalkan {formatRupiah(hasil.ditinggal)} di laci untuk modal berikutnya.
        </p>
      </div>
    );
  }
  if (!sesi) return <KasBelumDibuka />;
  return <FormTutup key={sesi.id} pengguna={pengguna} sesi={sesi} onSelesai={onSelesai} />;
}

function Baris({ label, nilai, tebal }: { label: string; nilai: string; tebal?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-2 py-1 ${tebal ? 'text-xl font-bold text-stone-900' : 'text-lg text-stone-800'}`}>
      <span>{label}</span>
      <span className="whitespace-nowrap">{nilai}</span>
    </div>
  );
}

function Selisih({ nilai }: { nilai: number }) {
  return (
    <p className={`text-lg font-bold ${nilai === 0 ? 'text-green-800' : 'text-red-800'}`}>Selisih {formatRupiah(nilai)}</p>
  );
}

function FormTutup({ pengguna, sesi, onSelesai }: { pengguna: Pengguna; sesi: SesiKas; onSelesai(h: HasilTutup): void }) {
  const pesanan = usePantau<Pesanan[]>((cb, onError) => pantauPesananSesi(db, sesi.id, cb, onError), sesi.id);
  const pengeluaran = usePantau<Pengeluaran[]>((cb, onError) => pantauPengeluaranSesi(db, sesi.id, cb, onError), sesi.id);

  const [dihitung, setDihitung] = useState<number | null>(null);
  const [qris, setQris] = useState<number | null>(null);
  const [ditinggal, setDitinggal] = useState<number | null>(sesi.modalAwal);
  const [disetorDiubah, setDisetorDiubah] = useState<number | null | undefined>(undefined); // undefined = follows
  const [catatan, setCatatan] = useState('');
  const [galat, setGalat] = useState<string | null>(null);

  const galatMuat = pesanan.galat ?? pengeluaran.galat;
  if (galatMuat) {
    return <LayarGalat pesan={galatMuat} onCobaLagi={() => { pesanan.cobaLagi(); pengeluaran.cobaLagi(); }} />;
  }
  if (!pesanan.data || !pengeluaran.data) return <LayarMemuat />;

  const r = ringkasSesi(sesi, pesanan.data, pengeluaran.data);
  // Blind count: the expected figures stay hidden until both counts are typed, so nobody copies the target.
  const sudahDihitung = dihitung !== null && qris !== null;
  const disetor = disetorDiubah !== undefined
    ? disetorDiubah
    : dihitung === null || ditinggal === null ? null : Math.max(0, dihitung - ditinggal);

  let kesalahan: string[];
  if (dihitung !== null && qris !== null && disetor !== null && ditinggal !== null) {
    kesalahan = validasiTutup({ ringkasan: r, tunaiDihitung: dihitung, qrisMerchant: qris, disetor, ditinggal, catatan });
  } else {
    kesalahan = [
      ...(dihitung === null ? ['Isi uang tunai yang dihitung.'] : []),
      ...(qris === null ? ['Isi total QRIS dari aplikasi merchant. Tulis 0 kalau tidak ada.'] : []),
      ...(dihitung !== null && (disetor === null || ditinggal === null) ? ['Isi uang yang disetor dan yang ditinggal.'] : []),
      // Figures that match exactly leave only the checks that do not depend on the inputs (unpaid orders).
      ...validasiTutup({
        ringkasan: r, tunaiDihitung: r.tunaiSeharusnya, qrisMerchant: r.penjualanQris,
        disetor: r.tunaiSeharusnya, ditinggal: 0, catatan: '',
      }),
    ];
  }

  async function tutup() {
    if (dihitung === null || qris === null || disetor === null || ditinggal === null) return;
    setGalat(null);
    try {
      await tutupSesi(db, { uid: pengguna.uid, nama: pengguna.nama }, sesi.id, {
        tunaiDihitung: dihitung, qrisMerchant: qris, disetor, ditinggal, catatan: catatan.trim(),
      });
      onSelesai({ sesiId: sesi.id, disetor, ditinggal });
    } catch (e) {
      setGalat(pesanGalat(e));
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 p-4">
      <h2 className="text-2xl font-bold text-stone-900">Tutup Kas</h2>

      <div className="flex flex-col gap-2">
        <InputRupiah label="Uang tunai dihitung" value={dihitung} onChange={setDihitung}
          keterangan="Hitung semua uang di laci sekarang. Angka seharusnya muncul setelah uang tunai dan QRIS diisi." />
        {sudahDihitung && <Selisih nilai={dihitung - r.tunaiSeharusnya} />}
      </div>

      <div className="flex flex-col gap-2">
        <InputRupiah label="Total QRIS di aplikasi merchant" value={qris} onChange={setQris}
          keterangan="Lihat total QRIS hari ini di aplikasi merchant. Tulis 0 kalau tidak ada." />
        {sudahDihitung && (
          <>
            <p className="text-base text-stone-800">Menurut aplikasi ini: {formatRupiah(r.penjualanQris)}</p>
            <Selisih nilai={qris - r.penjualanQris} />
          </>
        )}
      </div>

      {sudahDihitung && (
        <section className="rounded-xl border border-stone-200 bg-white p-3">
          <Baris label="Modal awal" nilai={formatRupiah(sesi.modalAwal)} />
          <Baris label="Penjualan tunai" nilai={`+ ${formatRupiah(r.penjualanTunai)}`} />
          <Baris label="Pengeluaran dari laci" nilai={`− ${formatRupiah(r.pengeluaranLaci)}`} />
          <div className="mt-1 border-t border-stone-200 pt-1">
            <Baris label="Uang tunai seharusnya" nilai={formatRupiah(r.tunaiSeharusnya)} tebal />
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
        <InputRupiah label="Disetor ke pemilik" value={disetor} onChange={setDisetorDiubah} />
        <InputRupiah label="Ditinggal di laci" value={ditinggal} onChange={setDitinggal}
          keterangan="Untuk modal kas berikutnya." />
      </div>

      <label className="flex flex-col gap-1 text-base font-medium text-stone-800">
        Catatan
        <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} placeholder="mis. uang kembalian kurang"
          className="rounded-xl border-2 border-stone-300 bg-white px-3 py-2 text-lg font-normal outline-none focus:border-orange-700" />
        <span className="text-sm font-normal text-stone-700">Wajib diisi kalau ada selisih.</span>
      </label>

      {kesalahan.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 rounded-xl bg-amber-50 py-3 pl-8 pr-3 text-base text-amber-950">
          {kesalahan.map((k) => <li key={k}>{k}</li>)}
        </ul>
      )}
      {galat && <p role="alert" className="whitespace-pre-line text-base font-medium text-red-800">{galat}</p>}
      <Tombol onClick={tutup} disabled={kesalahan.length > 0} className="min-h-14 text-xl">Tutup Kas</Tombol>
    </div>
  );
}
