// Diadaptasi dari verssache/qris-dinamis (MIT License, (c) 2020 QRIS Dinamis)

export class QrisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QrisError';
  }
}

export interface TlvEntry {
  tag: string;
  value: string;
}

/** CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, tanpa refleksi, tanpa XOR akhir. */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function parseTLV(s: string): TlvEntry[] {
  const hasil: TlvEntry[] = [];
  let i = 0;
  while (i < s.length) {
    const tag = s.slice(i, i + 2);
    const lenStr = s.slice(i + 2, i + 4);
    if (tag.length < 2 || !/^\d{2}$/.test(lenStr)) {
      throw new QrisError('Format QRIS rusak: panjang data tidak terbaca.');
    }
    const len = parseInt(lenStr, 10);
    const value = s.slice(i + 4, i + 4 + len);
    if (value.length < len) {
      throw new QrisError('Format QRIS rusak: data terpotong.');
    }
    hasil.push({ tag, value });
    i += 4 + len;
  }
  return hasil;
}

export function validasiQris(s: string): { valid: boolean; namaMerchant?: string; alasan?: string } {
  if (!s.startsWith('000201')) return { valid: false, alasan: 'Bukan kode QRIS (awalnya harus 000201).' };
  if (s.length < 8) return { valid: false, alasan: 'Kode QRIS terlalu pendek.' };
  let entri: TlvEntry[];
  try {
    entri = parseTLV(s);
  } catch (e) {
    return { valid: false, alasan: (e as Error).message };
  }
  if (!entri.some((e) => e.tag === '58')) return { valid: false, alasan: 'Kode QRIS tidak punya kode negara (tag 58).' };
  if (s.slice(-4) !== crc16(s.slice(0, -4))) return { valid: false, alasan: 'Kode pengaman (CRC) QRIS tidak cocok.' };
  return { valid: true, namaMerchant: entri.find((e) => e.tag === '59')?.value };
}

const tlv = (tag: string, value: string) => tag + String(value.length).padStart(2, '0') + value;

export function qrisDinamis(statis: string, nominal: number): string {
  if (!Number.isInteger(nominal) || nominal <= 0) {
    throw new QrisError('Nominal harus bilangan bulat lebih dari 0.');
  }
  const cek = validasiQris(statis);
  if (!cek.valid) throw new QrisError(cek.alasan ?? 'Kode QRIS tidak valid.');

  const buang = new Set(['54', '55', '56', '57', '63']);
  let hasil = '';
  for (const { tag, value } of parseTLV(statis)) {
    if (tag === '58') hasil += tlv('54', String(nominal));
    if (buang.has(tag)) continue;
    hasil += tlv(tag, tag === '01' ? '12' : value);
  }
  hasil += '6304';
  return hasil + crc16(hasil);
}
