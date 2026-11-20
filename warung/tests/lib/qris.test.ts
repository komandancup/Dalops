import { describe, expect, it } from 'vitest';
import { crc16, parseTLV, qrisDinamis, QrisError, validasiQris } from '../../src/lib/qris';

const tlv = (tag: string, value: string) => tag + String(value.length).padStart(2, '0') + value;

function bangun(bagian: string[]): string {
  const badan = bagian.join('') + '6304';
  return badan + crc16(badan);
}

const AKUN = tlv('00', 'ID.CO.QRIS.WWW') + tlv('02', 'ID1234567890123');
const BAGIAN_ATAS = [tlv('00', '01'), tlv('01', '11'), tlv('26', AKUN), tlv('52', '5812'), tlv('53', '360')];
const BAGIAN_BAWAH = [tlv('58', 'ID'), tlv('59', 'WARUNG LELE 1'), tlv('60', 'JAKARTA')];

const STATIS = bangun([...BAGIAN_ATAS, ...BAGIAN_BAWAH]);
const TANPA_TAG_58 = bangun([...BAGIAN_ATAS, tlv('59', 'WARUNG LELE 1'), tlv('60', 'JAKARTA')]);

describe('qris', () => {
  it('crc16 cocok dengan vektor standar', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('parseTLV membaca dan menolak panjang yang rusak', () => {
    expect(parseTLV('0002AB5903XYZ')).toEqual([
      { tag: '00', value: 'AB' },
      { tag: '59', value: 'XYZ' },
    ]);
    expect(() => parseTLV('0099AB')).toThrow(QrisError);
    expect(() => parseTLV('00')).toThrow(QrisError);
  });

  it('validasiQris', () => {
    expect(validasiQris(STATIS)).toEqual({ valid: true, namaMerchant: 'WARUNG LELE 1' });
    expect(validasiQris(STATIS.slice(0, -1) + '0').valid).toBe(false);
    expect(validasiQris('abc').valid).toBe(false);
    expect(validasiQris(TANPA_TAG_58).valid).toBe(false);
  });

  it('qrisDinamis mengubah statis menjadi dinamis', () => {
    const d = qrisDinamis(STATIS, 23000);
    expect(d).toContain('010212');
    expect(d).not.toContain('010211');
    expect(d).toContain('540523000' + '5802ID');
    expect(validasiQris(d).valid).toBe(true);
    expect(validasiQris(d).namaMerchant).toBe('WARUNG LELE 1');
  });

  it('qrisDinamis dari input dinamis mengganti nominal lama', () => {
    const d = qrisDinamis(STATIS, 23000);
    const d2 = qrisDinamis(d, 5000);
    expect(parseTLV(d2).filter((e) => e.tag === '54').length).toBe(1);
    expect(d2).toContain('54045000' + '5802ID');
    expect(validasiQris(d2).valid).toBe(true);
  });

  it('qrisDinamis menolak input buruk', () => {
    expect(() => qrisDinamis(TANPA_TAG_58, 1000)).toThrow(QrisError);
    expect(() => qrisDinamis(STATIS, 0)).toThrow(QrisError);
    expect(() => qrisDinamis(STATIS, 1500.5)).toThrow(QrisError);
    expect(() => qrisDinamis(STATIS.slice(0, -1) + '0', 1000)).toThrow(QrisError);
  });
});
