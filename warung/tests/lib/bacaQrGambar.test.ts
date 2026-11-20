import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import { bacaQrDariPiksel } from '../../src/lib/bacaQrGambar';
import { crc16, validasiQris } from '../../src/lib/qris';

const tlv = (tag: string, value: string) => tag + String(value.length).padStart(2, '0') + value;
const AKUN = tlv('00', 'ID.CO.QRIS.WWW') + tlv('02', 'ID1234567890123');
const BADAN = [tlv('00', '01'), tlv('01', '11'), tlv('26', AKUN), tlv('52', '5812'), tlv('53', '360'),
  tlv('58', 'ID'), tlv('59', 'WARUNG LELE 1'), tlv('60', 'JAKARTA')].join('') + '6304';
const STATIS = BADAN + crc16(BADAN);

describe('bacaQrDariPiksel', () => {
  it('membaca kode QRIS dari gambar PNG', async () => {
    expect(validasiQris(STATIS).valid).toBe(true);
    const png = PNG.sync.read(await QRCode.toBuffer(STATIS, { width: 480, margin: 4, errorCorrectionLevel: 'M' }));
    const data = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length);
    expect(bacaQrDariPiksel(data, png.width, png.height)).toBe(STATIS);
  });

  it('mengembalikan null bila tidak ada kode QR', () => {
    const putih = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    expect(bacaQrDariPiksel(putih, 100, 100)).toBeNull();
  });
});
