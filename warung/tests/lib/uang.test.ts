import { describe, it, expect } from 'vitest';
import { formatRupiah, parseRupiah } from '../../src/lib/uang';

describe('formatRupiah', () => {
  it('formats with dot thousands separator', () => {
    expect(formatRupiah(15000)).toBe('Rp 15.000');
    expect(formatRupiah(0)).toBe('Rp 0');
    expect(formatRupiah(-2500)).toBe('-Rp 2.500');
    expect(formatRupiah(1250000)).toBe('Rp 1.250.000');
  });
});

describe('parseRupiah', () => {
  it('parses valid input', () => {
    expect(parseRupiah('15.000')).toBe(15000);
    expect(parseRupiah('15000')).toBe(15000);
    expect(parseRupiah('Rp15.000')).toBe(15000);
    expect(parseRupiah(' Rp 15.000 ')).toBe(15000);
  });
  it('returns null for blank or invalid', () => {
    expect(parseRupiah('')).toBeNull();
    expect(parseRupiah('abc')).toBeNull();
    expect(parseRupiah('12,5')).toBeNull();
  });
});
