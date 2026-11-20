import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pelaku, Pesanan } from '../../src/types';

const m = vi.hoisted(() => ({
  native: true,
  catatCetak: vi.fn(async () => {}),
  plugin: {
    checkBluetoothPermissions: vi.fn(async () => ({ granted: true })),
    getPairedDevices: vi.fn(async () => ({ devices: [{ name: 'RPP02N', address: 'AA:BB' }] })),
    isConnected: vi.fn(async () => ({ connected: false })),
    connect: vi.fn(async () => {}),
    connectInsecure: vi.fn(async () => {}),
    write: vi.fn(async (_o: { address: string; value: string }) => {}),
  },
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => m.native } }));
vi.mock('@ascentio-it/capacitor-bluetooth-serial', () => ({ BluetoothSerial: m.plugin }));
vi.mock('../../src/firebase', () => ({ db: { palsu: true } }));
vi.mock('../../src/data/pesanan', () => ({ catatCetak: m.catatCetak }));

const { cariPrinter, cetakPesanan, printerTersedia, simpanPrinter } = await import('../../src/printer/printer');

const budi: Pelaku = { uid: 'u1', nama: 'Budi' };
const waktu = new Date('2026-11-20T12:05:00Z');
function buat(o: Partial<Pesanan> = {}): Pesanan {
  return {
    id: 'p1', sesiKasId: 's1', tanggal: '2026-11-20', nomor: 7, label: '', catatan: '',
    item: [{ menuId: 'a', nama: 'Pecel Lele', harga: 15000, jumlah: 2 }],
    total: 30000, status: 'lunas', caraBayar: 'tunai', uangDiterima: 50000,
    jumlahCetak: 0, dibuatOleh: budi, dibuatPada: waktu, dilunasiOleh: budi, dilunasiPada: waktu,
    dibatalkanOleh: null, dibatalkanPada: null, alasanBatal: null, ...o,
  };
}

function simpanan(): Map<string, string> {
  const isi = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => isi.get(k) ?? null,
    setItem: (k: string, v: string) => void isi.set(k, v),
    removeItem: (k: string) => void isi.delete(k),
  });
  return isi;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  m.native = true;
  simpanan().set('warung.printer', 'AA:BB');
});

describe('cetakPesanan', () => {
  it('menolak pesanan yang belum lunas', async () => {
    await expect(cetakPesanan(buat({ status: 'belum_bayar', caraBayar: null }), 'Warung')).rejects.toThrow(
      'Struk hanya untuk pesanan lunas.',
    );
    expect(m.plugin.write).not.toHaveBeenCalled();
    expect(m.catatCetak).not.toHaveBeenCalled();
  });

  it('cetak ulang mengirim SALINAN ke printer tersimpan lalu mencatat cetak sekali', async () => {
    await cetakPesanan(buat({ jumlahCetak: 1 }), 'Warung Bu Sri');
    expect(m.plugin.write).toHaveBeenCalledTimes(1);
    const { address, value } = m.plugin.write.mock.calls[0][0];
    expect(address).toBe('AA:BB');
    expect(value).toContain('SALINAN');
    expect(value.charCodeAt(0)).toBe(0x1b); // ESC @ init
    expect(m.catatCetak).toHaveBeenCalledTimes(1);
    expect(m.catatCetak).toHaveBeenCalledWith({ palsu: true }, 'p1');
  });

  it('cetakan pertama tanpa SALINAN', async () => {
    await cetakPesanan(buat(), 'Warung');
    expect(m.plugin.write.mock.calls[0][0].value).not.toContain('SALINAN');
  });

  it('kalau printer gagal menulis, cetak tidak dicatat', async () => {
    m.plugin.write.mockRejectedValueOnce(new Error('Error writing'));
    await expect(cetakPesanan(buat(), 'Warung')).rejects.toThrow('Printer tidak tersambung. Cek Bluetooth dan printer.');
    expect(m.catatCetak).not.toHaveBeenCalled();
  });

  it('kalau struk tercetak tapi gagal dicatat, cetak berikutnya tetap SALINAN dan catatan yang tertinggal diulang', async () => {
    m.catatCetak.mockRejectedValueOnce(Object.assign(new Error('Firebase: offline'), { code: 'unavailable' }));
    const p = buat({ id: 'p-sinyal' });
    await expect(cetakPesanan(p, 'Warung')).rejects.toThrow('offline');
    expect(m.plugin.write.mock.calls[0][0].value).not.toContain('SALINAN');

    // Same stale order (jumlahCetak still 0): the paper already went out once.
    await cetakPesanan(p, 'Warung');
    expect(m.plugin.write.mock.calls[1][0].value).toContain('SALINAN');
    // One record for the earlier print that was not saved, one for this print.
    expect(m.catatCetak).toHaveBeenCalledTimes(3);
    expect(m.catatCetak).toHaveBeenLastCalledWith({ palsu: true }, 'p-sinyal');

    // All recorded now: a later print of the fresh order (jumlahCetak 2) records exactly once more.
    m.catatCetak.mockClear();
    await cetakPesanan(buat({ id: 'p-sinyal', jumlahCetak: 2 }), 'Warung');
    expect(m.catatCetak).toHaveBeenCalledTimes(1);
  });

  it('kalau belum memilih printer, minta pilih dulu', async () => {
    simpanan();
    await expect(cetakPesanan(buat(), 'Warung')).rejects.toThrow('Belum ada printer. Pilih printer di Pengaturan Printer.');
    expect(m.catatCetak).not.toHaveBeenCalled();
  });

  it('kalau izin Bluetooth ditolak, beri tahu', async () => {
    m.plugin.checkBluetoothPermissions.mockResolvedValueOnce({ granted: false });
    await expect(cetakPesanan(buat(), 'Warung')).rejects.toThrow('Izin Bluetooth ditolak. Izinkan Bluetooth untuk aplikasi Warung.');
    expect(m.plugin.write).not.toHaveBeenCalled();
  });

  it('di browser membuka jendela cetak 58 mm lalu mencatat cetak', async () => {
    m.native = false;
    const tulis = vi.fn();
    const jendela = { document: { open: vi.fn(), write: tulis, close: vi.fn() }, focus: vi.fn(), print: vi.fn(), close: vi.fn() };
    vi.stubGlobal('window', { open: vi.fn(() => jendela) });
    await cetakPesanan(buat({ jumlahCetak: 2 }), 'Warung <Bu> Sri');
    const html = tulis.mock.calls.map((c) => c[0]).join('');
    expect(html).toContain('58mm');
    expect(html).toContain('SALINAN');
    expect(html).toContain('Warung &lt;Bu&gt; Sri');
    expect(jendela.print).toHaveBeenCalled();
    expect(m.plugin.write).not.toHaveBeenCalled();
    expect(m.catatCetak).toHaveBeenCalledTimes(1);
  });

  it('di browser yang memblokir jendela baru, tidak dicatat', async () => {
    m.native = false;
    vi.stubGlobal('window', { open: vi.fn(() => null) });
    await expect(cetakPesanan(buat(), 'Warung')).rejects.toThrow('Jendela cetak diblokir browser. Izinkan pop-up lalu coba lagi.');
    expect(m.catatCetak).not.toHaveBeenCalled();
  });
});

describe('printer lain', () => {
  it('printerTersedia mengikuti platform native', () => {
    expect(printerTersedia()).toBe(true);
    m.native = false;
    expect(printerTersedia()).toBe(false);
  });

  it('cariPrinter meminta izin lalu mengembalikan perangkat yang sudah dipasangkan', async () => {
    expect(await cariPrinter()).toEqual([{ nama: 'RPP02N', alamat: 'AA:BB' }]);
    expect(m.plugin.checkBluetoothPermissions).toHaveBeenCalled();
  });

  it('cariPrinter di browser kosong', async () => {
    m.native = false;
    expect(await cariPrinter()).toEqual([]);
    expect(m.plugin.getPairedDevices).not.toHaveBeenCalled();
  });

  it('simpanPrinter tidak melempar kalau penyimpanan diblokir', () => {
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('blocked'); } });
    expect(() => simpanPrinter('CC:DD')).not.toThrow();
  });
});
