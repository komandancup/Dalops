/** Format a Rupiah integer as "Rp 15.000" (negative: "-Rp 2.500"). Locale-independent. */
export function formatRupiah(n: number): string {
  const abs = Math.abs(Math.round(n));
  const digits = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 && abs !== 0 ? '-' : ''}Rp ${digits}`;
}

/** Parse user-typed Rupiah ("15.000", "Rp 15.000", "15000"). Returns null if blank or invalid. */
export function parseRupiah(s: string): number | null {
  const t = s.trim().replace(/^Rp\.?/i, '').trim();
  if (t === '') return null;
  if (!/^\d{1,3}(\.\d{3})+$|^\d+$/.test(t)) return null;
  const n = Number(t.replace(/\./g, ''));
  return Number.isSafeInteger(n) ? n : null;
}
