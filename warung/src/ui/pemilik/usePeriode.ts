import { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ambilPeriode } from '../../data/sesi';
import { pesanGalat } from '../galat';

export type Periode = Awaited<ReturnType<typeof ambilPeriode>>;

/**
 * One-shot fetch of everything dated in [dari, sampai]. ambilPeriode does not follow changes, so
 * screens offer muatUlang() and call it after their own writes.
 */
export function usePeriode(dari: string, sampai: string) {
  const [data, setData] = useState<Periode | undefined>(undefined);
  const [galat, setGalat] = useState<string | null>(null);
  const [muatKe, setMuatKe] = useState(0);

  useEffect(() => {
    let aktif = true;
    setData(undefined);
    setGalat(null);
    ambilPeriode(db, dari, sampai).then(
      (d) => aktif && setData(d),
      (e) => aktif && setGalat(pesanGalat(e)),
    );
    return () => {
      aktif = false;
    };
  }, [dari, sampai, muatKe]);

  return { data, galat, muatUlang: () => setMuatKe((n) => n + 1) };
}
