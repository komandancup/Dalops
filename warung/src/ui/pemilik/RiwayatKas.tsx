import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../../firebase';
import { tambahKoreksi } from '../../data/koreksi';
import { cekSesi } from '../../lib/rekap';
import { jamWIB, tanggalWIB } from '../../lib/tanggal';
import { formatRupiah } from '../../lib/uang';
import type { Koreksi, Pengguna, SesiKas } from '../../types';
import { pesanGalat } from '../galat';
import Dialog from '../komponen/Dialog';
import InputRupiah from '../komponen/InputRupiah';
import Tombol from '../komponen/Tombol';
import { LayarGalat, LayarMemuat } from '../Status';
import PilihRentang, { rentangPreset, type Rentang } from './PilihRentang';
import type { Tujuan } from './Lainnya';
import { usePeriode, type Periode } from './usePeriode';

const waktu = (d: Date) => `${tanggalWIB(d)} ${jamWIB(d)}`;
const warnaSelisih = (n: number) => (n === 0 ? 'text-green-800' : 'text-red-800');

/** Every cash session in a range, newest first. Close figures are re-checked against the records (R5). */
export default function RiwayatKas({ pengguna, fokus }: { pengguna: Pengguna; fokus?: Tujuan['fokus'] }) {
  const [rentang, setRentang] = useState<Rentang>(() => {
    const r = rentangPreset('30hari');
    return fokus && fokus.tanggal < r.dari ? { ...r, dari: fokus.tanggal } : r;
  });
  const periode = usePeriode(rentang.dari, rentang.sampai);
  const [kabar, setKabar] = useState<string | null>(null);
  // Kept here, not in the list: the list unmounts while a refetch loads (e.g. after a koreksi).
  const [terbuka, setTerbuka] = useState<string | null>(fokus?.id ?? null);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pt-0">
      <h2 className="text-2xl font-bold text-stone-900">Riwayat Kas</h2>
      <PilihRentang nilai={rentang} onUbah={setRentang} />
      {kabar && <p role="status" className="rounded-xl bg-green-800 p-3 text-center text-base font-medium text-white">{kabar}</p>}
      {periode.galat ? (
        <LayarGalat pesan={periode.galat} onCobaLagi={periode.muatUlang} />
      ) : !periode.data ? (
        <LayarMemuat />
      ) : (
        <Daftar
          data={periode.data}
          pengguna={pengguna}
          fokusId={fokus?.id ?? null}
          terbuka={terbuka}
          onTerbuka={setTerbuka}
          onKoreksi={(teks) => {
            setKabar(teks);
            periode.muatUlang();
          }}
        />
      )}
    </div>
  );
}

function Daftar({ data, pengguna, fokusId, terbuka, onTerbuka: setTerbuka, onKoreksi }: {
  data: Periode; pengguna: Pengguna; fokusId: string | null;
  terbuka: string | null; onTerbuka(id: string | null): void; onKoreksi(teks: string): void;
}) {
  const [koreksiUntuk, setKoreksiUntuk] = useState<SesiKas | null>(null);
  const fokusRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    fokusRef.current?.scrollIntoView?.({ block: 'start' });
  }, []);

  const sesi = [...data.sesi].sort((a, b) => b.dibukaPada.getTime() - a.dibukaPada.getTime());
  if (sesi.length === 0) return <p className="p-4 text-center text-lg text-stone-700">Tidak ada kas di rentang ini.</p>;

  return (
    <>
      <ul className="flex flex-col gap-2">
        {sesi.map((s) => (
          <li key={s.id} ref={s.id === fokusId ? fokusRef : undefined}
            className={`rounded-xl border-2 bg-white ${s.id === fokusId ? 'border-orange-600' : 'border-stone-200'}`}>
            <Sesi
              sesi={s}
              data={data}
              terbuka={terbuka === s.id}
              onBuka={() => setTerbuka(terbuka === s.id ? null : s.id)}
              onTambahKoreksi={() => setKoreksiUntuk(s)}
            />
          </li>
        ))}
      </ul>
      {koreksiUntuk && (
        <KoreksiBaru
          pengguna={pengguna}
          sesi={koreksiUntuk}
          onTutup={() => setKoreksiUntuk(null)}
          onTersimpan={(nominal) => {
            setKoreksiUntuk(null);
            onKoreksi(`Koreksi ${formatRupiah(nominal)} untuk kas ${koreksiUntuk.tanggal} tersimpan.`);
          }}
        />
      )}
    </>
  );
}

function Sesi({ sesi: s, data, terbuka, onBuka, onTambahKoreksi }: {
  sesi: SesiKas; data: Periode; terbuka: boolean; onBuka(): void; onTambahKoreksi(): void;
}) {
  const tutup = s.status === 'tutup';
  const c = tutup ? cekSesi(s, data.pesanan, data.pengeluaran) : null;
  const koreksi = data.koreksi.filter((k) => k.sesiKasId === s.id).sort((a, b) => a.dibuatPada.getTime() - b.dibuatPada.getTime());

  return (
    <>
      <button type="button" aria-expanded={terbuka} onClick={onBuka}
        className="flex min-h-14 w-full items-start justify-between gap-2 p-3 text-left active:bg-stone-50">
        <span className="flex min-w-0 flex-col">
          <span className="text-lg font-bold text-stone-900">Kas {s.tanggal}</span>
          <span className="text-sm text-stone-700">
            {tutup ? `Ditutup ${s.ditutupOleh?.nama ?? ''}` : `Masih buka · ${s.dibukaOleh.nama}`}
          </span>
          {c && (
            <span className="text-base font-semibold">
              <span className={warnaSelisih(c.selisihTunai)}>Tunai {formatRupiah(c.selisihTunai)}</span>
              <span className="text-stone-500"> · </span>
              <span className={warnaSelisih(c.selisihQris)}>QRIS {formatRupiah(c.selisihQris)}</span>
            </span>
          )}
          {c && !c.cocok && <span className="text-sm font-semibold text-red-800">Angka tutup tidak cocok dengan catatan</span>}
        </span>
        {terbuka ? <ChevronUp aria-hidden className="size-6 shrink-0" /> : <ChevronDown aria-hidden className="size-6 shrink-0" />}
      </button>

      {terbuka && (
        <div className="flex flex-col gap-1 border-t border-stone-200 p-3">
          <Baris label="Dibuka">{s.dibukaOleh.nama}, {waktu(s.dibukaPada)}</Baris>
          <Baris label="Modal awal">{formatRupiah(s.modalAwal)}</Baris>
          {s.alasanUbahModal && (
            <Baris label="Modal disarankan">{formatRupiah(s.modalSaran)} (diubah: {s.alasanUbahModal})</Baris>
          )}
          {c ? (
            <>
              <Baris label="Ditutup">{s.ditutupOleh?.nama}, {s.ditutupPada && waktu(s.ditutupPada)}</Baris>
              <Baris label="Tunai seharusnya"><Hitung nilai={c.tunaiSeharusnya} tersimpan={c.tunaiSeharusnyaTersimpan} /></Baris>
              <Baris label="Tunai dihitung">{formatRupiah(s.tunaiDihitung ?? 0)}</Baris>
              <Baris label="Selisih tunai"><Hitung nilai={c.selisihTunai} tersimpan={c.selisihTunaiTersimpan} selisih /></Baris>
              <Baris label="QRIS di aplikasi"><Hitung nilai={c.qrisAplikasi} tersimpan={c.qrisAplikasiTersimpan} /></Baris>
              <Baris label="QRIS di merchant">{formatRupiah(s.qrisMerchant ?? 0)}</Baris>
              <Baris label="Selisih QRIS"><Hitung nilai={c.selisihQris} tersimpan={c.selisihQrisTersimpan} selisih /></Baris>
              <Baris label="Disetor ke pemilik">{formatRupiah(s.disetor ?? 0)}</Baris>
              <Baris label="Ditinggal di laci">{formatRupiah(s.ditinggal ?? 0)}</Baris>
              <Baris label="Catatan">{s.catatan ?? '-'}</Baris>
              {c.jumlahBelumBayar > 0 && (
                <p className="text-base font-semibold text-red-800">Ditutup dengan {c.jumlahBelumBayar} pesanan belum bayar.</p>
              )}
            </>
          ) : (
            <p className="text-base text-stone-700">Kas ini belum ditutup.</p>
          )}

          <h4 className="mt-2 text-lg font-bold text-stone-900">Koreksi</h4>
          {koreksi.length === 0 ? (
            <p className="text-base text-stone-700">Belum ada koreksi.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {koreksi.map((k: Koreksi) => (
                <li key={k.id} className="rounded-lg bg-stone-100 p-2">
                  <p className="text-base font-semibold text-stone-900">{formatRupiah(k.nominal)} · {k.catatan}</p>
                  <p className="text-sm text-stone-700">{k.dibuatOleh.nama}, {waktu(k.dibuatPada)}</p>
                </li>
              ))}
            </ul>
          )}
          <Tombol onClick={onTambahKoreksi} jenis="kedua" className="mt-2 w-full">Tambah catatan koreksi</Tombol>
        </div>
      )}
    </>
  );
}

function Baris({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-base">
      <span className="shrink-0 text-stone-700">{label}</span>
      <span className="min-w-0 text-right font-medium text-stone-900">{children}</span>
    </div>
  );
}

/** A recomputed figure; the phone's stored figure is shown beside it only when they differ. */
function Hitung({ nilai, tersimpan, selisih }: { nilai: number; tersimpan: number; selisih?: boolean }) {
  return (
    <span className="flex flex-col items-end">
      <span className={selisih ? `font-bold ${warnaSelisih(nilai)}` : undefined}>{formatRupiah(nilai)}</span>
      {nilai !== tersimpan && <span className="text-sm font-semibold text-red-800">tercatat {formatRupiah(tersimpan)}</span>}
    </span>
  );
}

function KoreksiBaru({ pengguna, sesi, onTutup, onTersimpan }: {
  pengguna: Pengguna; sesi: SesiKas; onTutup(): void; onTersimpan(nominal: number): void;
}) {
  const idCatatan = useId();
  const [kurang, setKurang] = useState(false);
  const [nominal, setNominal] = useState<number | null>(0);
  const [catatan, setCatatan] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const nilai = !nominal ? 0 : kurang ? -nominal : nominal;

  async function simpan() {
    setGalat(null);
    setMenyimpan(true);
    try {
      await tambahKoreksi(db, { uid: pengguna.uid, nama: pengguna.nama }, sesi.id, nilai, catatan);
      onTersimpan(nilai);
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setMenyimpan(false);
    }
  }

  const pilihan = (aktif: boolean) => `min-h-12 rounded-xl border-2 px-2 text-base font-semibold ${
    aktif ? 'border-orange-700 bg-orange-50 text-orange-900' : 'border-stone-300 bg-white text-stone-900'
  }`;

  return (
    <Dialog judul={`Koreksi kas ${sesi.tanggal}`} onTutup={onTutup} kunci={menyimpan}>
      <div className="flex flex-col gap-4">
        <p className="text-base text-stone-800">Koreksi tidak mengubah catatan kas. Nominal ini ditambahkan ke perkiraan laba.</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={!kurang} onClick={() => setKurang(false)} className={pilihan(!kurang)}>Tambah (+)</button>
          <button type="button" aria-pressed={kurang} onClick={() => setKurang(true)} className={pilihan(kurang)}>Kurangi (−)</button>
        </div>
        <InputRupiah label="Nominal" value={nominal} onChange={setNominal} keterangan={`Dicatat sebagai ${formatRupiah(nilai)}. Boleh 0.`} />
        <div className="flex flex-col gap-1">
          <label htmlFor={idCatatan} className="text-base font-medium text-stone-800">Catatan</label>
          <textarea id={idCatatan} value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2}
            placeholder="mis. uang Rp 5.000 terselip di laci"
            className="rounded-xl border-2 border-stone-300 bg-white px-3 py-2 text-lg outline-none focus:border-orange-700" />
          <p className="text-sm text-stone-700">Wajib diisi.</p>
        </div>
        {galat && <p role="alert" className="text-base font-medium text-red-800">{galat}</p>}
        <Tombol onClick={simpan} disabled={catatan.trim() === ''} className="min-h-14 text-xl">Simpan Koreksi</Tombol>
      </div>
    </Dialog>
  );
}
