import { useEffect, useRef, useState } from 'react';
import { pesanGalat } from './galat';

type Pantau<T> = (cb: (data: T) => void, onError: (e: Error) => void) => () => void;

/**
 * Subscribes with a pantau* listener while mounted. Re-subscribes when `kunci` changes or on cobaLagi().
 * `data` is undefined until the first snapshot; `galat` holds the Indonesian error text.
 */
export function usePantau<T>(pantau: Pantau<T>, kunci: string) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [galat, setGalat] = useState<string | null>(null);
  const [muatKe, setMuatKe] = useState(0);
  const mulai = useRef(pantau);
  mulai.current = pantau;

  useEffect(() => {
    setData(undefined);
    setGalat(null);
    return mulai.current((d) => setData(() => d), (e) => setGalat(pesanGalat(e)));
  }, [kunci, muatKe]);

  return { data, galat, cobaLagi: () => setMuatKe((n) => n + 1) };
}
