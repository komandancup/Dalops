// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const m = vi.hoisted(() => ({
  native: true,
  tersimpan: null as string | null,
  otomatis: false,
  cariPrinter: vi.fn(),
  simpanPrinter: vi.fn(),
  aturCetakOtomatis: vi.fn(),
  cetakTes: vi.fn(),
}));
vi.mock('../../src/printer/printer', () => ({
  printerTersedia: () => m.native,
  printerTersimpan: () => m.tersimpan,
  cetakOtomatis: () => m.otomatis,
  cariPrinter: m.cariPrinter,
  simpanPrinter: m.simpanPrinter,
  aturCetakOtomatis: m.aturCetakOtomatis,
  cetakTes: m.cetakTes,
}));

import PengaturanPrinter from '../../src/ui/PengaturanPrinter';

beforeEach(() => {
  m.native = true;
  m.tersimpan = null;
  m.otomatis = false;
  m.cariPrinter.mockReset().mockResolvedValue([
    { nama: 'RPP02N', alamat: 'AA:BB' },
    { nama: 'Headset', alamat: 'CC:DD' },
  ]);
  m.simpanPrinter.mockReset();
  m.aturCetakOtomatis.mockReset();
  m.cetakTes.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('PengaturanPrinter', () => {
  it('lists paired printers and saves the chosen one', async () => {
    const user = userEvent.setup();
    render(<PengaturanPrinter namaWarung="Warung Lele" />);
    const pilihan = await screen.findByRole('radio', { name: /RPP02N/ });
    expect(pilihan).toHaveProperty('checked', false);
    await user.click(pilihan);
    expect(m.simpanPrinter).toHaveBeenCalledWith('AA:BB');
    expect(screen.getByRole('radio', { name: /RPP02N/ })).toHaveProperty('checked', true);
  });

  it('marks the saved printer and prints a test receipt', async () => {
    m.tersimpan = 'CC:DD';
    const user = userEvent.setup();
    render(<PengaturanPrinter namaWarung="Warung Lele" />);
    expect(await screen.findByRole('radio', { name: /Headset/ })).toHaveProperty('checked', true);
    await user.click(screen.getByRole('button', { name: 'Cetak tes' }));
    expect(m.cetakTes).toHaveBeenCalledWith('Warung Lele');
    expect(await screen.findByText('Struk tes terkirim ke printer.')).toBeTruthy();
  });

  it('shows printer errors and lets the user search again', async () => {
    m.cariPrinter.mockRejectedValueOnce(new Error('Bluetooth mati. Nyalakan Bluetooth lalu coba lagi.'));
    const user = userEvent.setup();
    render(<PengaturanPrinter namaWarung="W" />);
    expect((await screen.findByRole('alert')).textContent).toBe('Bluetooth mati. Nyalakan Bluetooth lalu coba lagi.');
    await user.click(screen.getByRole('button', { name: 'Cari printer lagi' }));
    expect(await screen.findByRole('radio', { name: /RPP02N/ })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('toggles automatic printing', async () => {
    m.otomatis = true;
    const user = userEvent.setup();
    render(<PengaturanPrinter namaWarung="W" />);
    const saklar = screen.getByRole('checkbox', { name: /Cetak struk otomatis/ });
    expect(saklar).toHaveProperty('checked', true);
    await user.click(saklar);
    expect(m.aturCetakOtomatis).toHaveBeenCalledWith(false);
    expect(saklar).toHaveProperty('checked', false);
  });

  it('in a browser explains that Bluetooth works only in the Android app', async () => {
    m.native = false;
    const user = userEvent.setup();
    render(<PengaturanPrinter namaWarung="W" />);
    expect(screen.getByText(/hanya bisa di aplikasi Android Warung/)).toBeTruthy();
    expect(screen.getByText(/jendela cetak browser/)).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(m.cariPrinter).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cetak tes' }));
    expect(m.cetakTes).toHaveBeenCalledWith('W');
  });
});
