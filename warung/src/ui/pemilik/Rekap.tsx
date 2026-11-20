import { useState } from 'react';
import { Download } from 'lucide-react';
import { keCSV, rekapPeriode, type Rekap as DataRekap } from '../../lib/rekap';
import { formatRupiah } from '../../lib/uang';
import Tombol from '../komponen/Tombol';
import { LayarGalat, LayarMemuat } from '../Status';
import PilihRentang, { rentangPreset, type Rentang } from './PilihRentang';
import { usePeriode } from './usePeriode';

/** Sales, expenses and estimated profit for a chosen range, with a CSV download. */
export default function Rekap() {
  const [rentang, setRentang] = useState<Rentang>(() => rentangPreset('7hari'));
  const periode = usePeriode(rentang.dari, rentang.sampai);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pt-0">
      <h2 className="text-2xl font-bold text-stone-900">Rekap</h2>
      <PilihRentang nilai={rentang} onUbah={setRentang} />
      {periode.galat ? (
        <LayarGalat pesan={periode.galat} onCobaLagi={periode.muatUlang} />
      ) : !periode.data ? (
        <LayarMemuat />
      ) : (
        <Isi r={rekapPeriode(periode.data, rentang.dari, rentang.sampai)} rentang={rentang} />
      )}
    </div>
  );
}

function unduhCSV(r: DataRekap, { dari, sampai }: Rentang) {
  const url = URL.createObjectURL(new Blob([keCSV(r, dari, sampai)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `rekap-${dari}-${sampai}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // revoking at once can cancel the download in some browsers
}

function Isi({ r, rentang }: { r: DataRekap; rentang: Rentang }) {
  const kategori = Object.entries(r.pengeluaranPerKategori).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const puncak = Math.max(1, ...r.perHari.map((h) => Math.max(h.penjualan, h.pengeluaran)));
  const puncakKategori = Math.max(1, ...kategori.map(([, n]) => n));

  return (
    <>
      <section aria-label="Ringkasan" className="grid grid-cols-2 gap-2">
        <Kartu label="Penjualan" nilai={formatRupiah(r.penjualanTotal)} lebar />
        <Kartu label="Tunai" nilai={formatRupiah(r.penjualanTunai)} />
        <Kartu label="QRIS" nilai={formatRupiah(r.penjualanQris)} />
        <Kartu label="Jumlah pesanan" nilai={String(r.jumlahPesanan)} />
        <Kartu label="Pengeluaran" nilai={formatRupiah(r.pengeluaranTotal)} />
        <Kartu label="Koreksi" nilai={formatRupiah(r.koreksiTotal)} lebar />
        <Kartu label="Perkiraan laba" nilai={formatRupiah(r.perkiraanLaba)} warna={r.perkiraanLaba < 0 ? 'text-red-800' : 'text-green-800'} lebar />
      </section>

      <Tombol onClick={() => unduhCSV(r, rentang)} jenis="kedua" className="flex items-center justify-center gap-2">
        <Download aria-hidden className="size-5" /> Unduh CSV
      </Tombol>

      <section aria-labelledby="judul-harian" className="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-4">
        <h3 id="judul-harian" className="text-xl font-bold text-stone-900">Per hari</h3>
        <p className="flex gap-4 text-sm text-stone-700">
          <span className="flex items-center gap-1"><span className="inline-block size-3 rounded-sm bg-orange-600" /> Penjualan</span>
          <span className="flex items-center gap-1"><span className="inline-block size-3 rounded-sm bg-stone-500" /> Pengeluaran</span>
        </p>
        <ul className="flex flex-col gap-2">
          {r.perHari.map((h) => (
            <li key={h.tanggal} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-stone-800">{h.tanggal.slice(8)}/{h.tanggal.slice(5, 7)}</span>
                <span className="text-stone-700">{formatRupiah(h.penjualan)} · {formatRupiah(h.pengeluaran)}</span>
              </div>
              <div className="h-3 rounded-sm bg-stone-100">
                <div className="h-3 rounded-sm bg-orange-600" style={{ width: `${(h.penjualan / puncak) * 100}%` }} />
              </div>
              <div className="h-1.5 rounded-sm bg-stone-100">
                <div className="h-1.5 rounded-sm bg-stone-500" style={{ width: `${(h.pengeluaran / puncak) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="judul-kategori" className="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-4">
        <h3 id="judul-kategori" className="text-xl font-bold text-stone-900">Pengeluaran per jenis</h3>
        {kategori.length === 0 ? (
          <p className="text-base text-stone-700">Tidak ada pengeluaran.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {kategori.map(([nama, n]) => (
              <li key={nama} className="flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-2 text-base">
                  <span className="text-stone-800">{nama}</span>
                  <span className="font-semibold text-stone-900">{formatRupiah(n)}</span>
                </div>
                <div className="h-2 rounded-sm bg-stone-100">
                  <div className="h-2 rounded-sm bg-stone-500" style={{ width: `${(n / puncakKategori) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="judul-terlaris" className="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-4">
        <h3 id="judul-terlaris" className="text-xl font-bold text-stone-900">10 menu terlaris</h3>
        {r.menuTerlaris.length === 0 ? (
          <p className="text-base text-stone-700">Belum ada penjualan.</p>
        ) : (
          <ol className="flex flex-col">
            {r.menuTerlaris.slice(0, 10).map((m, i) => (
              <li key={m.nama} className="flex items-baseline justify-between gap-2 border-b border-stone-100 py-1.5 text-base last:border-0">
                <span className="min-w-0 truncate text-stone-900">{i + 1}. {m.nama}</span>
                <span className="whitespace-nowrap text-stone-700">{m.porsi} porsi · {formatRupiah(m.rupiah)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function Kartu({ label, nilai, lebar, warna = 'text-stone-900' }: { label: string; nilai: string; lebar?: boolean; warna?: string }) {
  return (
    <div className={`rounded-xl border border-stone-200 bg-white p-3 ${lebar ? 'col-span-2' : ''}`}>
      <p className="text-sm text-stone-700">{label}</p>
      <p className={`${lebar ? 'text-3xl' : 'text-lg'} font-bold ${warna}`}>{nilai}</p>
    </div>
  );
}
