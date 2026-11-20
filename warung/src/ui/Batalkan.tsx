import { useId, useState, type ReactNode } from 'react';
import { pesanGalat } from './galat';
import Dialog from './komponen/Dialog';
import Tombol from './komponen/Tombol';

interface Props {
  judul: string;
  /** What is being cancelled (number, total…), shown above the reason. */
  children: ReactNode;
  /** Button text, e.g. "Batalkan Pesanan". */
  tombol: string;
  /** Records the cancellation; a rejection is shown here, the caller closes on success. */
  onBatalkan(alasan: string): Promise<void>;
  onTutup(): void;
}

/** Shared cancel dialog: the reason is required. */
export default function Batalkan({ judul, children, tombol, onBatalkan, onTutup }: Props) {
  const id = useId();
  const [alasan, setAlasan] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  async function batalkan() {
    setGalat(null);
    setMenyimpan(true);
    try {
      await onBatalkan(alasan.trim());
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <Dialog judul={judul} onTutup={onTutup} kunci={menyimpan}>
      <div className="flex flex-col gap-4">
        <div className="text-lg text-stone-800">{children}</div>
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-base font-medium text-stone-800">Alasan pembatalan</label>
          <textarea id={id} value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={2}
            placeholder="mis. pembeli tidak jadi"
            className="rounded-xl border-2 border-stone-300 bg-white px-3 py-2 text-lg outline-none focus:border-orange-700" />
          <p className="text-sm text-stone-700">Wajib diisi. Pemilik bisa melihat alasan ini.</p>
        </div>
        {galat && <p role="alert" className="text-base font-medium text-red-800">{galat}</p>}
        <Tombol onClick={batalkan} jenis="bahaya" disabled={alasan.trim() === ''} className="min-h-14 text-xl">
          {tombol}
        </Tombol>
      </div>
    </Dialog>
  );
}
