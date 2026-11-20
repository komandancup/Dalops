import type { ItemPesanan, Pengeluaran, Pesanan, SesiKas } from '../types';
import { formatRupiah } from './uang';

export function hitungTotal(item: ItemPesanan[]): number {
  return item.reduce((sum, i) => sum + i.harga * i.jumlah, 0);
}

export function ringkasSesi(sesi: SesiKas, pesanan: Pesanan[], pengeluaran: Pengeluaran[]) {
  let penjualanTunai = 0;
  let penjualanQris = 0;
  let jumlahBelumBayar = 0;
  for (const p of pesanan) {
    if (p.status === 'belum_bayar') jumlahBelumBayar++;
    else if (p.status === 'lunas') {
      if (p.caraBayar === 'tunai') penjualanTunai += p.total;
      else if (p.caraBayar === 'qris') penjualanQris += p.total;
    }
  }
  const pengeluaranLaci = pengeluaran
    .filter((e) => e.status === 'aktif' && e.dariLaci)
    .reduce((sum, e) => sum + e.nominal, 0);
  return {
    penjualanTunai,
    penjualanQris,
    pengeluaranLaci,
    tunaiSeharusnya: sesi.modalAwal + penjualanTunai - pengeluaranLaci,
    jumlahBelumBayar,
  };
}

export function validasiTutup(input: {
  ringkasan: ReturnType<typeof ringkasSesi>;
  tunaiDihitung: number;
  qrisMerchant: number;
  disetor: number;
  ditinggal: number;
  catatan: string;
}): string[] {
  const { ringkasan, tunaiDihitung, qrisMerchant, disetor, ditinggal, catatan } = input;
  const errors: string[] = [];
  const adaCatatan = catatan.trim() !== '';
  if (ringkasan.jumlahBelumBayar > 0) {
    errors.push(`Masih ada ${ringkasan.jumlahBelumBayar} pesanan belum bayar. Lunasi atau batalkan dulu.`);
  }
  const selisihTunai = tunaiDihitung - ringkasan.tunaiSeharusnya;
  if (selisihTunai !== 0 && !adaCatatan) {
    errors.push(`Uang tunai selisih ${formatRupiah(selisihTunai)}. Tulis catatan.`);
  }
  const selisihQris = qrisMerchant - ringkasan.penjualanQris;
  if (selisihQris !== 0 && !adaCatatan) {
    errors.push(`QRIS selisih ${formatRupiah(selisihQris)}. Tulis catatan.`);
  }
  if (disetor + ditinggal !== tunaiDihitung) {
    errors.push(`Setor + ditinggal harus sama dengan uang yang dihitung (${formatRupiah(tunaiDihitung)}).`);
  }
  return errors;
}
