// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Pengguna, SesiKas } from '../../src/types';

const m = vi.hoisted(() => ({ catatPengeluaran: vi.fn(), batalkanPengeluaran: vi.fn(), daftar: [] as unknown[] }));
vi.mock('../../src/firebase', () => ({ db: {}, auth: {} }));
vi.mock('../../src/data/pengeluaran', () => ({
  catatPengeluaran: m.catatPengeluaran,
  batalkanPengeluaran: m.batalkanPengeluaran,
  pantauPengeluaranSesi: (_db: unknown, _id: string, cb: (p: unknown[]) => void) => {
    cb(m.daftar);
    return () => {};
  },
}));

import Pengeluaran from '../../src/ui/Pengeluaran';

const pengguna: Pengguna = { uid: 'u1', nama: 'Sari', username: 'sari', peran: 'karyawan', aktif: true };
const sesi = { id: 's1', status: 'buka', tanggal: '2026-11-20', modalAwal: 100000 } as SesiKas;

beforeEach(() => {
  m.catatPengeluaran.mockReset().mockResolvedValue(undefined);
  m.batalkanPengeluaran.mockReset().mockResolvedValue(undefined);
  m.daftar = [
    { id: 'e1', kategori: 'Gas', keterangan: 'tabung 3 kg', nominal: 22000, dariLaci: true, status: 'aktif', dibuatOleh: { uid: 'u2', nama: 'Budi' } },
  ];
});
afterEach(cleanup);

describe('Pengeluaran', () => {
  it('records an expense; Uang dari laci? defaults to yes', async () => {
    const user = userEvent.setup();
    render(<Pengeluaran pengguna={pengguna} sesi={sesi} />);
    const simpan = screen.getByRole('button', { name: 'Simpan Pengeluaran' });
    const laci = screen.getByRole('switch', { name: /Uang dari laci\?/ });
    expect(laci.getAttribute('aria-checked')).toBe('true');
    expect(simpan).toHaveProperty('disabled', true);
    await user.click(screen.getByRole('button', { name: 'Minyak' }));
    await user.type(screen.getByLabelText('Nominal'), '30000');
    await user.type(screen.getByLabelText('Keterangan'), 'minyak 2 liter');
    await user.click(laci);
    expect(laci.getAttribute('aria-checked')).toBe('false');
    await user.click(simpan);
    expect(m.catatPengeluaran).toHaveBeenCalledWith({}, { uid: 'u1', nama: 'Sari' }, {
      sesiKasId: 's1', kategori: 'Minyak', keterangan: 'minyak 2 liter', nominal: 30000, dariLaci: false,
    });
    expect(await screen.findByText('Pengeluaran Minyak Rp 30.000 tersimpan.')).toBeTruthy();
    expect((screen.getByLabelText('Nominal') as HTMLInputElement).value).toBe('');
    expect(laci.getAttribute('aria-checked')).toBe('true');
  });

  it("lists today's expenses and cancels one with a reason", async () => {
    const user = userEvent.setup();
    render(<Pengeluaran pengguna={pengguna} sesi={sesi} />);
    const baris = screen.getByText('tabung 3 kg').closest('li')!;
    expect(baris.textContent).toContain('Rp 22.000');
    expect(baris.textContent).toContain('Dari laci · Dicatat Budi');
    await user.click(within(baris).getByRole('button', { name: 'Batalkan' }));
    const dialog = screen.getByRole('dialog', { name: 'Batalkan Pengeluaran' });
    await user.type(within(dialog).getByLabelText('Alasan pembatalan'), 'dobel');
    await user.click(within(dialog).getByRole('button', { name: 'Batalkan Pengeluaran' }));
    expect(m.batalkanPengeluaran).toHaveBeenCalledWith({}, { uid: 'u1', nama: 'Sari' }, 'e1', 'dobel');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
