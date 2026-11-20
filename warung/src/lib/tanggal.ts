const TZ = 'Asia/Jakarta';

const tanggalFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const jamFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Date as YYYY-MM-DD in WIB (Asia/Jakarta). */
export function tanggalWIB(d: Date): string {
  return tanggalFmt.format(d);
}

/** Time as HH:MM (24h) in WIB. */
export function jamWIB(d: Date): string {
  return jamFmt.format(d);
}
