import type { Pesanan } from '../types';

export { bolehCetak } from '../lib/struk';

/**
 * Prints the receipt of a paid order. Stub until Task 14 (ruling R3): it resolves without printing.
 * The real implementation keeps this signature and records the print itself (catatCetak).
 */
export async function cetakPesanan(p: Pesanan, namaWarung: string): Promise<void> {
  console.info(`cetakPesanan (belum tersedia): #${p.nomor} ${namaWarung}`);
}
