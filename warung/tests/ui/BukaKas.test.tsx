// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Pengguna } from '../../src/types';

const m = vi.hoisted(() => ({ bukaSesi: vi.fn(), ambilSesiAktif: vi.fn() }));
vi.mock('../../src/firebase', () => ({ db: {}, auth: {} }));
vi.mock('../../src/data/sesi', () => ({ bukaSesi: m.bukaSesi, ambilSesiAktif: m.ambilSesiAktif }));

import BukaKas from '../../src/ui/BukaKas';

const pengguna: Pengguna = { uid: 'u1', nama: 'Sari', username: 'sari', peran: 'karyawan', aktif: true };

beforeEach(() => {
  m.bukaSesi.mockReset().mockResolvedValue({});
  m.ambilSesiAktif.mockReset().mockResolvedValue({ aktif: null, modalSaran: 200000 });
});
afterEach(cleanup);

describe('BukaKas', () => {
  it('opens with the suggested modal and no alasan', async () => {
    const user = userEvent.setup();
    render(<BukaKas pengguna={pengguna} />);
    expect(((await screen.findByLabelText('Modal awal di laci')) as HTMLInputElement).value).toBe('200.000');
    expect(screen.queryByLabelText(/Alasan/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Buka Kas' }));
    expect(m.bukaSesi).toHaveBeenCalledWith({}, { uid: 'u1', nama: 'Sari' }, 200000, null);
  });

  it('requires Alasan when the modal differs, then sends it', async () => {
    const user = userEvent.setup();
    render(<BukaKas pengguna={pengguna} />);
    const modal = await screen.findByLabelText('Modal awal di laci');
    await user.clear(modal);
    await user.type(modal, '150000');
    expect(screen.getByText('Wajib diisi karena modal berbeda dari saran.')).toBeTruthy();
    const tombol = screen.getByRole('button', { name: 'Buka Kas' });
    expect(tombol).toHaveProperty('disabled', true);
    await user.click(tombol);
    expect(m.bukaSesi).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Alasan/), ' uang kecil ditukar ');
    await user.click(tombol);
    expect(m.bukaSesi).toHaveBeenCalledWith({}, { uid: 'u1', nama: 'Sari' }, 150000, 'uang kecil ditukar');
  });
});
