import { describe, it, expect } from 'vitest';
import { tambahHari, tanggalWIB, jamWIB } from '../../src/lib/tanggal';

describe('tanggalWIB / jamWIB', () => {
  it('rolls over to the next day at 17:00 UTC', () => {
    expect(tanggalWIB(new Date('2026-11-20T17:30:00Z'))).toBe('2026-11-21');
    expect(tanggalWIB(new Date('2026-11-20T16:59:00Z'))).toBe('2026-11-20');
  });
  it('formats time as HH:MM in WIB', () => {
    expect(jamWIB(new Date('2026-11-20T17:30:00Z'))).toBe('00:30');
  });
});

describe('tambahHari', () => {
  it('moves a YYYY-MM-DD string by whole days across month and year ends', () => {
    expect(tambahHari('2026-11-20', -6)).toBe('2026-11-14');
    expect(tambahHari('2026-12-31', 1)).toBe('2027-01-01');
    expect(tambahHari('2026-03-01', -1)).toBe('2026-02-28');
  });
});
