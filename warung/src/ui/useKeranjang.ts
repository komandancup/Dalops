import { useState } from 'react';
import { hitungTotal } from '../lib/kas';
import type { Menu } from '../types';

export interface BarisKeranjang { menu: Menu; jumlah: number }

/** Cart for the cashier screen. Lines keep tap order; a line that drops to 0 is removed. */
export function useKeranjang() {
  const [baris, setBaris] = useState<BarisKeranjang[]>([]);
  const [label, setLabel] = useState('');
  const [catatan, setCatatan] = useState('');

  const tambah = (menu: Menu) =>
    setBaris((bs) =>
      bs.some((b) => b.menu.id === menu.id)
        ? bs.map((b) => (b.menu.id === menu.id ? { ...b, jumlah: b.jumlah + 1 } : b))
        : [...bs, { menu, jumlah: 1 }],
    );
  const kurang = (menuId: string) =>
    setBaris((bs) => bs.map((b) => (b.menu.id === menuId ? { ...b, jumlah: b.jumlah - 1 } : b)).filter((b) => b.jumlah > 0));
  const kosongkan = () => {
    setBaris([]);
    setLabel('');
    setCatatan('');
  };

  return {
    baris, label, catatan, setLabel, setCatatan, tambah, kurang, kosongkan,
    jumlahItem: baris.reduce((n, b) => n + b.jumlah, 0),
    total: hitungTotal(baris.map((b) => ({ menuId: b.menu.id, nama: b.menu.nama, harga: b.menu.harga, jumlah: b.jumlah }))),
  };
}
