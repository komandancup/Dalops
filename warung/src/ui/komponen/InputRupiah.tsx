import { useId } from 'react';
import { formatRupiah } from '../../lib/uang';

interface Props {
  label: string;
  value: number | null;
  onChange(n: number | null): void;
  /** Extra text under the field (e.g. a hint or an error). */
  keterangan?: string;
}

/** Rupiah field: digits only, shown with dot thousands separators ("50.000"). Empty = null. */
export default function InputRupiah({ label, value, onChange, keterangan }: Props) {
  const id = useId();
  const tampil = value === null ? '' : formatRupiah(value).replace(/^Rp /, '');
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-base font-medium text-stone-800">{label}</label>
      <div className="flex items-center rounded-xl border-2 border-stone-300 bg-white focus-within:border-orange-700">
        <span className="pl-3 text-lg text-stone-600">Rp</span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={tampil}
          onChange={(e) => {
            const digit = e.target.value.replace(/\D/g, '').slice(0, 12);
            onChange(digit === '' ? null : Number(digit));
          }}
          className="min-h-12 w-full rounded-xl bg-transparent px-2 text-xl font-semibold outline-none"
        />
      </div>
      {keterangan && <p className="text-sm text-stone-700">{keterangan}</p>}
    </div>
  );
}
