/**
 * Receipt printing.
 *
 * Bluetooth plugin: `@ascentio-it/capacitor-bluetooth-serial` (MIT, v8.0.1, built against Capacitor 8).
 * Why this one:
 *  - It speaks Bluetooth Classic SPP (RFCOMM, UUID 00001101-…), which is what cheap 58 mm thermal
 *    printers use. BLE-only plugins (e.g. @capacitor-community/bluetooth-le) cannot reach them.
 *  - It lists already-paired devices (`getPairedDevices`), so the owner pairs once in Android settings.
 *  - It writes raw data (`write`), so our own ESC/POS bytes from `keEscPos` go out unchanged.
 *  - It is the maintained Capacitor 8 line of the bluetooth-serial family (7.x → 8.x), and it requests
 *    BLUETOOTH_CONNECT/BLUETOOTH_SCAN at runtime on Android 12+ (`checkBluetoothPermissions`).
 * Known quirks (kept inside this file):
 *  - No peerDependencies declared; it is compiled against @capacitor/core 8 and needs Java 21.
 *  - `write` takes a string and sends it as UTF-8. `keEscPos` only emits bytes < 0x80, and those encode
 *    to themselves in UTF-8, so one char per byte is exact.
 *  - `checkBluetoothPermissions` is typed as boolean but resolves `{ granted }` on Android; both are handled.
 */
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial } from '@ascentio-it/capacitor-bluetooth-serial';
import { db } from '../firebase';
import { catatCetak } from '../data/pesanan';
import { barisStruk, bolehCetak, keEscPos } from '../lib/struk';
import type { Pesanan } from '../types';

export { bolehCetak } from '../lib/struk';

const KUNCI_PRINTER = 'warung.printer';
const KUNCI_OTOMATIS = 'warung.cetakOtomatis';

const GALAT_PRINTER = 'Printer tidak tersambung. Cek Bluetooth dan printer.';

export interface Printer { nama: string; alamat: string }

export function printerTersedia(): boolean {
  return Capacitor.isNativePlatform();
}

function baca(kunci: string): string | null {
  try {
    return localStorage.getItem(kunci);
  } catch {
    return null;
  }
}

function tulis(kunci: string, nilai: string): void {
  try {
    localStorage.setItem(kunci, nilai);
  } catch {
    // Storage blocked: the choice just is not remembered.
  }
}

export function simpanPrinter(alamat: string): void {
  tulis(KUNCI_PRINTER, alamat);
}

export function printerTersimpan(): string | null {
  return baca(KUNCI_PRINTER);
}

export function cetakOtomatis(): boolean {
  return baca(KUNCI_OTOMATIS) === 'true';
}

export function aturCetakOtomatis(aktif: boolean): void {
  tulis(KUNCI_OTOMATIS, String(aktif));
}

async function mintaIzin(): Promise<void> {
  let hasil: unknown;
  try {
    hasil = await BluetoothSerial.checkBluetoothPermissions();
  } catch {
    hasil = false;
  }
  const diizinkan = typeof hasil === 'boolean' ? hasil : (hasil as { granted?: boolean } | null)?.granted === true;
  if (!diizinkan) throw new Error('Izin Bluetooth ditolak. Izinkan Bluetooth untuk aplikasi Warung.');
}

/** Paired Bluetooth devices (empty outside the Android app). */
export async function cariPrinter(): Promise<Printer[]> {
  if (!printerTersedia()) return [];
  await mintaIzin();
  try {
    const { devices } = await BluetoothSerial.getPairedDevices();
    return devices.map((d) => ({ nama: d.name || d.address, alamat: d.address }));
  } catch {
    throw new Error('Bluetooth mati. Nyalakan Bluetooth lalu coba lagi.');
  }
}

async function kirimBluetooth(baris: string[]): Promise<void> {
  const address = printerTersimpan();
  if (!address) throw new Error('Belum ada printer. Pilih printer di Pengaturan Printer.');
  await mintaIzin();
  try {
    const { connected } = await BluetoothSerial.isConnected({ address });
    if (!connected) {
      try {
        await BluetoothSerial.connect({ address });
      } catch {
        await BluetoothSerial.connectInsecure({ address }); // some cheap printers only accept this
      }
    }
    const value = Array.from(keEscPos(baris), (b) => String.fromCharCode(b)).join('');
    await BluetoothSerial.write({ address, value });
  } catch {
    throw new Error(GALAT_PRINTER);
  }
}

const aman = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Browser fallback: a 58 mm wide monospace page in a new window, then the print dialog. */
function cetakBrowser(baris: string[]): void {
  const w = window.open('', '_blank', 'width=320,height=600');
  if (!w) throw new Error('Jendela cetak diblokir browser. Izinkan pop-up lalu coba lagi.');
  w.document.open();
  w.document.write(
    '<!doctype html><html><head><meta charset="utf-8"><title>Struk</title><style>' +
      '@page{size:58mm auto;margin:0}body{margin:0;width:58mm}' +
      'pre{margin:0;padding:2mm;font:11px/1.3 monospace;white-space:pre}' +
      `</style></head><body><pre>${aman(baris.join('\n'))}</pre></body></html>`,
  );
  w.document.close();
  w.focus();
  w.print();
}

async function kirim(baris: string[]): Promise<void> {
  if (printerTersedia()) await kirimBluetooth(baris);
  else cetakBrowser(baris);
}

/**
 * Prints that came out of the printer but whose jumlahCetak +1 did not reach the database yet
 * (e.g. the signal dropped), per order id. Kept for the life of the app so a retry still says SALINAN.
 */
const belumDicatat = new Map<string, number>();

/**
 * Prints the receipt of a paid order and records the print (jumlahCetak +1). Any reprint says SALINAN.
 * Nothing is recorded when printing fails. A print whose record failed is recorded on the next try.
 */
export async function cetakPesanan(p: Pesanan, namaWarung: string): Promise<void> {
  if (!bolehCetak(p)) throw new Error('Struk hanya untuk pesanan lunas.');
  const tertunda = belumDicatat.get(p.id) ?? 0;
  await kirim(barisStruk(p, namaWarung, p.jumlahCetak > 0 || tertunda > 0));
  belumDicatat.set(p.id, tertunda + 1);
  while ((belumDicatat.get(p.id) ?? 0) > 0) {
    await catatCetak(db, p.id); // a failure leaves the rest in belumDicatat
    const sisa = (belumDicatat.get(p.id) ?? 1) - 1;
    if (sisa > 0) belumDicatat.set(p.id, sisa);
    else belumDicatat.delete(p.id);
  }
}

/** Prints a sample receipt to check the printer. Not an order, so nothing is recorded. */
export async function cetakTes(namaWarung: string): Promise<void> {
  const kini = new Date();
  const contoh: Pesanan = {
    id: 'tes', sesiKasId: 'tes', tanggal: '', nomor: 0, label: 'CETAK TES', catatan: '',
    item: [
      { menuId: 'a', nama: 'Pecel Lele', harga: 15000, jumlah: 1 },
      { menuId: 'b', nama: 'Es Teh', harga: 4000, jumlah: 1 },
    ],
    total: 19000, status: 'lunas', caraBayar: 'tunai', uangDiterima: 20000, jumlahCetak: 0,
    dibuatOleh: { uid: 'tes', nama: 'Tes' }, dibuatPada: kini, dilunasiOleh: null, dilunasiPada: kini,
    dibatalkanOleh: null, dibatalkanPada: null, alasanBatal: null,
  };
  await kirim(barisStruk(contoh, namaWarung, false));
}
