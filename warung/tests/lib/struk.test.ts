import { describe, expect, it } from 'vitest';
import { barisStruk, bolehCetak, keEscPos } from '../../src/lib/struk';
import type { Pelaku, Pesanan } from '../../src/types';

const budi: Pelaku = { uid: 'u1', nama: 'Budi' };
const waktu = new Date('2026-11-20T12:05:00Z'); // 19:05 WIB

function buat(o: Partial<Pesanan> = {}): Pesanan {
  return {
    id: 'p', sesiKasId: 's1', tanggal: '2026-11-20', nomor: 7, label: 'Meja 2', catatan: '',
    item: [
      { menuId: 'a', nama: 'Pecel Lele', harga: 15000, jumlah: 2 },
      { menuId: 'b', nama: 'Es Teh', harga: 4000, jumlah: 1 },
    ],
    total: 34000, status: 'lunas', caraBayar: 'tunai', uangDiterima: 50000,
    jumlahCetak: 0, dibuatOleh: budi, dibuatPada: waktu, dilunasiOleh: budi, dilunasiPada: waktu,
    dibatalkanOleh: null, dibatalkanPada: null, alasanBatal: null, ...o,
  };
}

const kananRata = (kiri: string, kanan: string) => kiri + ' '.repeat(32 - kiri.length - kanan.length) + kanan;

describe('barisStruk', () => {
  it('semua baris maksimal 32 karakter', () => {
    for (const b of barisStruk(buat(), 'Warung Pecel Lele Bu Sri', true)) expect(b.length).toBeLessThanOrEqual(32);
  });

  it('berisi bagian struk sesuai urutan', () => {
    const baris = barisStruk(buat(), 'Warung Bu Sri', false);
    expect(baris[0]).toBe('Warung Bu Sri'.padStart(Math.floor((32 + 13) / 2)));
    const urut = [
      '20/11/2026 19:05',
      'No. 7  Meja 2',
      'Pecel Lele',
      kananRata('  2 x 15.000', '30.000'),
      kananRata('TOTAL', '34.000'),
      kananRata('Tunai', '50.000'),
      kananRata('Kembali', '16.000'),
      'Kasir: Budi',
    ];
    let pos = 0;
    for (const s of urut) {
      const i = baris.indexOf(s, pos);
      expect(i, s).toBeGreaterThanOrEqual(pos);
      pos = i + 1;
    }
    expect(baris[baris.length - 1].trim()).toBe('Terima kasih');
    expect(baris).toContain('-'.repeat(32));
  });

  it('salinan menaruh penanda di baris kedua', () => {
    expect(barisStruk(buat(), 'Warung', true)[1].trim()).toBe('*** SALINAN ***');
    expect(barisStruk(buat(), 'Warung', false)).not.toContain('*** SALINAN ***');
  });

  it('QRIS menampilkan QRIS tanpa Kembali', () => {
    const baris = barisStruk(buat({ caraBayar: 'qris', uangDiterima: null }), 'Warung', false);
    expect(baris).toContain(kananRata('QRIS', '34.000'));
    expect(baris.some((b) => b.startsWith('Kembali') || b.startsWith('Tunai'))).toBe(false);
  });

  it('tunai tanpa uangDiterima memakai total dan tanpa Kembali', () => {
    const baris = barisStruk(buat({ uangDiterima: null }), 'Warung', false);
    expect(baris).toContain(kananRata('Tunai', '34.000'));
    expect(baris.some((b) => b.startsWith('Kembali'))).toBe(false);
  });

  it('nama item panjang dibungkus dan tidak terpotong', () => {
    const nama = 'Paket Pecel Lele Super Jumbo Dengan Sambal Terasi Spesial';
    const baris = barisStruk(buat({ item: [{ menuId: 'x', nama, harga: 1000, jumlah: 1 }], total: 1000 }), 'Warung', false);
    const i = baris.findIndex((b) => b.startsWith('Paket'));
    expect(baris[i]).toBe('Paket Pecel Lele Super Jumbo');
    expect(baris.slice(i, i + 2).join(' ')).toBe(nama);
  });

  it('kata lebih panjang dari 32 dipecah paksa tanpa kehilangan huruf', () => {
    const nama = 'A'.repeat(70);
    const baris = barisStruk(buat({ item: [{ menuId: 'x', nama, harga: 1000, jumlah: 1 }], total: 1000 }), 'Warung', false);
    expect(baris.filter((b) => /^A+$/.test(b)).join('')).toBe(nama);
    for (const b of baris) expect(b.length).toBeLessThanOrEqual(32);
  });

  it('label kosong dihilangkan dari baris No.', () => {
    expect(barisStruk(buat({ label: '' }), 'Warung', false)).toContain('No. 7');
  });

  it('kasir memakai dilunasiOleh, cadangan dibuatOleh', () => {
    const rina: Pelaku = { uid: 'u2', nama: 'Rina' };
    expect(barisStruk(buat({ dilunasiOleh: rina }), 'W', false)).toContain('Kasir: Rina');
    expect(barisStruk(buat({ dilunasiOleh: null }), 'W', false)).toContain('Kasir: Budi');
  });

  it('tidak error untuk pesanan belum lunas', () => {
    expect(() => barisStruk(buat({ status: 'belum_bayar', caraBayar: null, dilunasiPada: null, dilunasiOleh: null }), 'W', false)).not.toThrow();
  });
});

describe('bolehCetak', () => {
  it('hanya true untuk lunas', () => {
    expect(bolehCetak(buat())).toBe(true);
    expect(bolehCetak(buat({ status: 'belum_bayar' }))).toBe(false);
    expect(bolehCetak(buat({ status: 'batal' }))).toBe(false);
  });
});

describe('keEscPos', () => {
  it('diawali init, diakhiri feed dan potong, memuat ASCII TOTAL', () => {
    const b = keEscPos(barisStruk(buat(), 'Warung', false));
    expect(Array.from(b.slice(0, 2))).toEqual([0x1b, 0x40]);
    expect(Array.from(b.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x00]);
    expect(new TextDecoder('latin1').decode(b)).toContain('TOTAL');
  });

  it('mengganti karakter non-ASCII dengan ?', () => {
    const b = keEscPos(['Café ×']);
    expect(new TextDecoder('latin1').decode(b)).toContain('Caf? ?');
  });
});
