import { useId, type InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'className' | 'id'> {
  label: string;
  value: string;
  onChange(v: string): void;
  keterangan?: string;
}

/** Labeled text field (label is always visible; the placeholder is only a format hint). */
export default function Kolom({ label, value, onChange, keterangan, ...sisa }: Props) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-base font-medium text-stone-800">{label}</label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...sisa}
        className="min-h-12 rounded-xl border-2 border-stone-300 bg-white px-3 text-lg outline-none focus:border-orange-700" />
      {keterangan && <p className="text-sm text-stone-700">{keterangan}</p>}
    </div>
  );
}
