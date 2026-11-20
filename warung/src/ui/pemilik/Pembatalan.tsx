import { useEffect, useRef, useState } from 'react';
import { jamWIB, tanggalWIB } from '../../lib/tanggal';
import { formatRupiah } from '../../lib/uang';
import type { Pelaku } from '../../types';
import { LayarGalat, LayarMemuat } from '../Status';
import type { Tujuan } from './Lainnya';
import PilihRentang, { rentangPreset, type Rentang } from './PilihRentang';
import { usePeriode, type Periode } from './usePeriode';

interface Batal {
  id: string;
  judul: string;
  nominal: number;
  keterangan: string;
  alasan: string;
  oleh: Pelaku;
  pada: Date;
}

/** Cancelled orders and expenses recorded in a range, newest cancellation first. */
function daftarBatal(d: Periode): Batal[] {
  const out: Batal[] = [];
  for (const p of d.pesanan) {
    if (p.status !== 'batal' || !p.dibatalkanOleh || !p.dibatalkanPada) continue;
    out.push({
      id: p.id,
      judul: `Pesanan #${p.nomor}${p.label ? ` · ${p.label}` : ''}`,
      nominal: p.total,
      keterangan: `${p.caraBayar ? `Sudah dibayar ${p.caraBayar === 'tunai' ? 'tunai' : 'QRIS'}` : 'Belum dibayar'} · dibuat ${p.dibuatOleh.nama}`,
      alasan: p.alasanBatal ?? '',
      oleh: p.dibatalkanOleh,
      pada: p.dibatalkanPada,
    });
  }
  for (const e of d.pengeluaran) {
    if (e.status !== 'batal' || !e.dibatalkanOleh || !e.dibatalkanPada) continue;
    out.push({
      id: e.id,
      judul: `Pengeluaran ${e.kategori}`,
      nominal: e.nominal,
      keterangan: `${e.keterangan ? `${e.keterangan} · ` : ''}dicatat ${e.dibuatOleh.nama}`,
      alasan: e.alasanBatal ?? '',
      oleh: e.dibatalkanOleh,
      pada: e.dibatalkanPada,
    });
  }
  return out.sort((a, b) => b.pada.getTime() - a.pada.getTime());
}

export default function Pembatalan({ fokus }: { fokus?: Tujuan['fokus'] }) {
  const [rentang, setRentang] = useState<Rentang>(() => (fokus ? { dari: fokus.tanggal, sampai: fokus.tanggal } : rentangPreset('7hari')));
  const periode = usePeriode(rentang.dari, rentang.sampai);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pt-0">
      <h2 className="text-2xl font-bold text-stone-900">Pembatalan</h2>
      <PilihRentang nilai={rentang} onUbah={setRentang} />
      {periode.galat ? (
        <LayarGalat pesan={periode.galat} onCobaLagi={periode.muatUlang} />
      ) : !periode.data ? (
        <LayarMemuat />
      ) : (
        <Daftar daftar={daftarBatal(periode.data)} fokusId={fokus?.id ?? null} />
      )}
    </div>
  );
}

function Daftar({ daftar, fokusId }: { daftar: Batal[]; fokusId: string | null }) {
  const fokusRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    fokusRef.current?.scrollIntoView?.({ block: 'start' });
  }, []);

  if (daftar.length === 0) return <p className="p-4 text-center text-lg text-stone-700">Tidak ada pembatalan di rentang ini.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {daftar.map((b) => (
        <li key={b.id} ref={b.id === fokusId ? fokusRef : undefined}
          className={`rounded-xl border-2 bg-white p-3 ${b.id === fokusId ? 'border-orange-600' : 'border-stone-200'}`}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-lg font-bold text-stone-900">{b.judul}</p>
            <p className="whitespace-nowrap text-lg font-bold text-stone-900">{formatRupiah(b.nominal)}</p>
          </div>
          <p className="text-sm text-stone-700">{b.keterangan}</p>
          <p className="text-base text-red-800">Alasan: {b.alasan}</p>
          <p className="text-sm text-stone-700">Dibatalkan {b.oleh.nama}, {tanggalWIB(b.pada)} {jamWIB(b.pada)}</p>
        </li>
      ))}
    </ul>
  );
}
