import { useId } from 'react';
import { tambahHari, tanggalWIB } from '../../lib/tanggal';

export interface Rentang { dari: string; sampai: string }

/** Preset date ranges ending today (WIB). */
export function rentangPreset(nama: 'hari' | '7hari' | 'bulan' | '30hari'): Rentang {
  const hari = tanggalWIB(new Date());
  if (nama === 'hari') return { dari: hari, sampai: hari };
  if (nama === '7hari') return { dari: tambahHari(hari, -6), sampai: hari };
  if (nama === '30hari') return { dari: tambahHari(hari, -29), sampai: hari };
  return { dari: `${hari.slice(0, 8)}01`, sampai: hari };
}

const PRESET = [
  { nama: 'hari', teks: 'Hari ini' },
  { nama: '7hari', teks: '7 hari' },
  { nama: 'bulan', teks: 'Bulan ini' },
] as const;

/** Hari ini · 7 hari · Bulan ini, plus two date fields for any other range. */
export default function PilihRentang({ nilai, onUbah }: { nilai: Rentang; onUbah(r: Rentang): void }) {
  const idDari = useId();
  const idSampai = useId();
  const kolom = 'min-h-12 w-full rounded-xl border-2 border-stone-300 bg-white px-2 text-base outline-none focus:border-orange-700';
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {PRESET.map((p) => {
          const r = rentangPreset(p.nama);
          const aktif = r.dari === nilai.dari && r.sampai === nilai.sampai;
          return (
            <button key={p.nama} type="button" aria-pressed={aktif} onClick={() => onUbah(r)}
              className={`min-h-12 rounded-xl border-2 px-1 text-base font-semibold ${
                aktif ? 'border-orange-700 bg-orange-50 text-orange-900' : 'border-stone-300 bg-white text-stone-900'
              }`}>
              {p.teks}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={idDari} className="text-sm font-medium text-stone-800">Dari</label>
          <input id={idDari} type="date" value={nilai.dari} max={nilai.sampai} className={kolom}
            onChange={(e) => e.target.value && onUbah({ dari: e.target.value, sampai: e.target.value > nilai.sampai ? e.target.value : nilai.sampai })} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={idSampai} className="text-sm font-medium text-stone-800">Sampai</label>
          <input id={idSampai} type="date" value={nilai.sampai} min={nilai.dari} className={kolom}
            onChange={(e) => e.target.value && onUbah({ dari: e.target.value < nilai.dari ? e.target.value : nilai.dari, sampai: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
