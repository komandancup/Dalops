import { AlertTriangle, RefreshCw } from 'lucide-react';
import { daftarPeringatan, rekapPeriode, type Peringatan } from '../../lib/rekap';
import { jamWIB, tambahHari, tanggalWIB } from '../../lib/tanggal';
import { formatRupiah } from '../../lib/uang';
import type { SesiKas } from '../../types';
import { LayarGalat, LayarMemuat } from '../Status';
import type { Tujuan } from './Lainnya';
import { usePeriode, type Periode } from './usePeriode';

interface Props {
  /** The open session, or null when the cash drawer is closed. */
  sesi: SesiKas | null;
  /** Opens the detail screen of a tapped alert. */
  onBuka(t: Tujuan): void;
}

/** Owner's first screen: today's numbers, cash drawer status and the last 7 days of alerts. */
export default function Beranda({ sesi, onBuka }: Props) {
  const hari = sesi?.tanggal ?? tanggalWIB(new Date());
  const periode = usePeriode(tambahHari(hari, -6), hari);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-bold text-stone-900">Beranda</h2>
        <button type="button" onClick={periode.muatUlang}
          className="flex min-h-12 items-center gap-2 rounded-xl border-2 border-stone-300 bg-white px-3 text-base font-semibold text-stone-900 active:bg-stone-100">
          <RefreshCw aria-hidden className="size-5" /> Muat ulang
        </button>
      </div>
      {periode.galat ? (
        <LayarGalat pesan={periode.galat} onCobaLagi={periode.muatUlang} />
      ) : !periode.data ? (
        <LayarMemuat />
      ) : (
        <Isi data={periode.data} hari={hari} sesi={sesi} onBuka={onBuka} />
      )}
    </div>
  );
}

function Isi({ data, hari, sesi, onBuka }: { data: Periode; hari: string } & Props) {
  const r = rekapPeriode(data, hari, hari);
  const peringatan = daftarPeringatan(data);
  const belumBayar = sesi ? data.pesanan.filter((p) => p.sesiKasId === sesi.id && p.status === 'belum_bayar').length : 0;

  function tujuan(p: Peringatan): Tujuan {
    if (p.jenis === 'batal_pesanan') {
      return { halaman: 'pembatalan', fokus: { id: p.refId, tanggal: data.pesanan.find((x) => x.id === p.refId)?.tanggal ?? hari } };
    }
    if (p.jenis === 'batal_pengeluaran') {
      return { halaman: 'pembatalan', fokus: { id: p.refId, tanggal: data.pengeluaran.find((x) => x.id === p.refId)?.tanggal ?? hari } };
    }
    return { halaman: 'riwayat', fokus: { id: p.refId, tanggal: data.sesi.find((x) => x.id === p.refId)?.tanggal ?? hari } };
  }

  return (
    <>
      <section aria-labelledby="judul-hari-ini" className="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id="judul-hari-ini" className="text-xl font-bold text-stone-900">Hari ini</h3>
          <p className="text-sm text-stone-700">{hari}</p>
        </div>
        <div>
          <p className="text-base text-stone-700">Penjualan</p>
          <p className="text-3xl font-bold text-stone-900">{formatRupiah(r.penjualanTotal)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Angka label="Tunai" nilai={formatRupiah(r.penjualanTunai)} />
          <Angka label="QRIS" nilai={formatRupiah(r.penjualanQris)} />
          <Angka label="Jumlah pesanan" nilai={String(r.jumlahPesanan)} />
          <Angka label="Pengeluaran" nilai={formatRupiah(r.pengeluaranTotal)} />
        </div>
        <div className="flex items-baseline justify-between gap-2 border-t border-stone-200 pt-2">
          <p className="text-lg font-medium text-stone-800">Perkiraan laba</p>
          <p className={`text-xl font-bold ${r.perkiraanLaba < 0 ? 'text-red-800' : 'text-green-800'}`}>{formatRupiah(r.perkiraanLaba)}</p>
        </div>
      </section>

      <section aria-label="Kas" className="flex flex-col gap-1 rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="text-base text-stone-700">Kas</h3>
        <p className="text-xl font-bold text-stone-900">
          {sesi ? `Buka sejak ${jamWIB(sesi.dibukaPada)} oleh ${sesi.dibukaOleh.nama}` : 'Tutup'}
        </p>
        {sesi && (
          <p className={`text-base font-medium ${belumBayar > 0 ? 'text-amber-800' : 'text-stone-700'}`}>
            {belumBayar} pesanan belum bayar
          </p>
        )}
      </section>

      <section aria-labelledby="judul-peringatan" className="flex flex-col gap-2">
        <h3 id="judul-peringatan" className="text-xl font-bold text-stone-900">Peringatan</h3>
        <p className="-mt-2 text-sm text-stone-700">7 hari terakhir, terbaru di atas. Ketuk untuk melihat rinciannya.</p>
        {peringatan.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-center text-base text-stone-700">Tidak ada peringatan. Semua angka cocok.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {peringatan.map((p, i) => (
              <li key={`${p.jenis}-${p.refId}-${i}`}>
                <button type="button" onClick={() => onBuka(tujuan(p))}
                  className={`flex min-h-12 w-full items-start gap-2 rounded-xl border-2 bg-white p-3 text-left active:bg-stone-100 ${
                    PENTING.has(p.jenis) ? 'border-red-300' : 'border-amber-300'
                  }`}>
                  <AlertTriangle aria-hidden className={`mt-0.5 size-5 shrink-0 ${PENTING.has(p.jenis) ? 'text-red-800' : 'text-amber-700'}`} />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-base font-medium text-stone-900">{p.pesan}</span>
                    <span className="text-sm text-stone-700">{tanggalWIB(p.waktu)} {jamWIB(p.waktu)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** Alerts about money that may be missing, drawn in red. */
const PENTING = new Set<Peringatan['jenis']>(['tutup_tidak_cocok', 'selisih_tunai', 'selisih_qris']);

function Angka({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="rounded-xl bg-stone-100 p-2">
      <p className="text-sm text-stone-700">{label}</p>
      <p className="text-lg font-bold text-stone-900">{nilai}</p>
    </div>
  );
}
