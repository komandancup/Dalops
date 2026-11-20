// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useKeranjang } from '../../src/ui/useKeranjang';
import type { Menu } from '../../src/types';

const lele: Menu = { id: 'm1', nama: 'Pecel Lele', harga: 15000, kategori: 'Makanan', aktif: true, urutan: 1 };
const teh: Menu = { id: 'm4', nama: 'Es Teh', harga: 4000, kategori: 'Minuman', aktif: true, urutan: 4 };

describe('useKeranjang', () => {
  it('counts portions and totals in insertion order', () => {
    const { result } = renderHook(() => useKeranjang());
    act(() => { result.current.tambah(lele); result.current.tambah(teh); result.current.tambah(lele); });
    expect(result.current.baris.map((b) => [b.menu.id, b.jumlah])).toEqual([['m1', 2], ['m4', 1]]);
    expect(result.current.jumlahItem).toBe(3);
    expect(result.current.total).toBe(34000);
  });

  it('drops a line when it reaches 0 and ignores unknown ids', () => {
    const { result } = renderHook(() => useKeranjang());
    act(() => { result.current.tambah(teh); result.current.kurang('m4'); result.current.kurang('xx'); });
    expect(result.current.baris).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it('kosongkan clears lines, label and catatan', () => {
    const { result } = renderHook(() => useKeranjang());
    act(() => { result.current.tambah(lele); result.current.setLabel('Meja 3'); result.current.setCatatan('pedas'); });
    act(() => result.current.kosongkan());
    expect(result.current.baris).toEqual([]);
    expect(result.current.label).toBe('');
    expect(result.current.catatan).toBe('');
  });
});
