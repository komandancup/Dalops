import type { Pesanan } from '../types';
import { jamWIB, tanggalWIB } from './tanggal';

const LEBAR = 32;

const angka = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function tengah(s: string): string {
  return ' '.repeat(Math.max(0, Math.floor((LEBAR - s.length) / 2))) + s;
}

function kananRata(kiri: string, kanan: string): string {
  const spasi = LEBAR - kiri.length - kanan.length;
  return kiri + ' '.repeat(Math.max(1, spasi)) + kanan;
}

/** Wrap on word boundaries; words longer than the width are hard-split. */
function bungkus(teks: string): string[] {
  const hasil: string[] = [];
  let baris = '';
  for (const kata of teks.split(/\s+/).filter(Boolean)) {
    let sisa = kata;
    while (sisa.length > LEBAR) {
      if (baris) { hasil.push(baris); baris = ''; }
      hasil.push(sisa.slice(0, LEBAR));
      sisa = sisa.slice(LEBAR);
    }
    if (!baris) baris = sisa;
    else if (baris.length + 1 + sisa.length <= LEBAR) baris += ' ' + sisa;
    else { hasil.push(baris); baris = sisa; }
  }
  if (baris) hasil.push(baris);
  return hasil;
}

export function bolehCetak(p: Pesanan): boolean {
  return p.status === 'lunas';
}

export function barisStruk(p: Pesanan, namaWarung: string, salinan: boolean): string[] {
  const garis = '-'.repeat(LEBAR);
  const waktu = p.dilunasiPada ?? p.dibuatPada;
  const [y, m, d] = tanggalWIB(waktu).split('-');
  const noLabel = p.label ? `No. ${p.nomor}  ${p.label}` : `No. ${p.nomor}`;

  const baris: string[] = [];
  for (const b of bungkus(namaWarung)) baris.push(tengah(b));
  if (salinan) baris.push(tengah('*** SALINAN ***'));
  baris.push(`${d}/${m}/${y} ${jamWIB(waktu)}`);
  baris.push(...(noLabel.length <= LEBAR ? [noLabel] : bungkus(noLabel)));
  baris.push(garis);
  for (const it of p.item) {
    baris.push(...bungkus(it.nama));
    baris.push(kananRata(`  ${it.jumlah} x ${angka(it.harga)}`, angka(it.harga * it.jumlah)));
  }
  baris.push(garis);
  baris.push(kananRata('TOTAL', angka(p.total)));
  if (p.caraBayar === 'qris') {
    baris.push(kananRata('QRIS', angka(p.total)));
  } else if (p.caraBayar === 'tunai') {
    baris.push(kananRata('Tunai', angka(p.uangDiterima ?? p.total)));
    if (p.uangDiterima != null) baris.push(kananRata('Kembali', angka(p.uangDiterima - p.total)));
  }
  baris.push(garis);
  baris.push(...bungkus(`Kasir: ${p.dilunasiOleh?.nama ?? p.dibuatOleh.nama}`));
  baris.push(tengah('Terima kasih'));
  return baris;
}

/** ESC/POS bytes: init, text lines (non-ASCII becomes '?'), feed and cut. */
export function keEscPos(baris: string[]): Uint8Array {
  const out: number[] = [0x1b, 0x40];
  for (const b of baris) {
    for (const ch of b) {
      const c = ch.codePointAt(0)!;
      out.push(c >= 0x20 && c < 0x7f ? c : 0x3f);
    }
    out.push(0x0a);
  }
  out.push(0x1d, 0x56, 0x42, 0x00);
  return Uint8Array.from(out);
}
