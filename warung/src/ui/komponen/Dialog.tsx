import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  judul: string;
  children: ReactNode;
  onTutup(): void;
  /** While true (e.g. a save is in flight) Escape, backdrop and X do nothing. */
  kunci?: boolean;
}

/** Bottom sheet on phones. Closes on Escape, the X button or a tap on the backdrop. */
export default function Dialog({ judul, children, onTutup, kunci = false }: Props) {
  const idJudul = useId();
  const kotak = useRef<HTMLDivElement>(null);
  const tutup = useRef(onTutup);
  tutup.current = kunci ? () => {} : onTutup;

  useEffect(() => {
    const sebelumnya = document.activeElement as HTMLElement | null;
    kotak.current?.focus();
    const tekan = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tutup.current();
    };
    document.addEventListener('keydown', tekan);
    return () => {
      document.removeEventListener('keydown', tekan);
      sebelumnya?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50" onClick={() => tutup.current()}>
      <div
        ref={kotak}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idJudul}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-stone-50 outline-none"
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2">
          <h2 id={idJudul} className="text-xl font-bold text-stone-900">{judul}</h2>
          <button type="button" aria-label="Tutup" onClick={onTutup} disabled={kunci}
            className="flex size-12 items-center justify-center rounded-full active:bg-stone-200 disabled:opacity-40">
            <X aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
