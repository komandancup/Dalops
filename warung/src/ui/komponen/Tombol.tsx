import { useRef, useState, type ReactNode } from 'react';

const GAYA = {
  utama: 'bg-orange-700 text-white active:bg-orange-800',
  kedua: 'bg-white text-stone-900 border-2 border-stone-300 active:bg-stone-100',
  bahaya: 'bg-red-700 text-white active:bg-red-800',
} as const;

interface Props {
  children: ReactNode;
  /** May return a promise: while it is pending the button is disabled and reads "Menyimpan…". */
  onClick: () => void | Promise<void>;
  jenis?: keyof typeof GAYA;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}

export default function Tombol({ children, onClick, jenis = 'utama', disabled, className = '', type = 'button' }: Props) {
  const sibuk = useRef(false); // guards double taps that land before React re-renders
  const [menyimpan, setMenyimpan] = useState(false);

  async function klik() {
    if (sibuk.current) return;
    const hasil = onClick();
    if (!(hasil instanceof Promise)) return;
    sibuk.current = true;
    setMenyimpan(true);
    try {
      await hasil;
    } finally {
      sibuk.current = false;
      setMenyimpan(false);
    }
  }

  return (
    <button
      type={type}
      onClick={() => void klik().catch(() => {})}
      disabled={disabled || menyimpan}
      className={`min-h-12 rounded-xl px-4 py-3 text-lg font-semibold disabled:opacity-50 ${GAYA[jenis]} ${className}`}
    >
      {menyimpan ? 'Menyimpan…' : children}
    </button>
  );
}
