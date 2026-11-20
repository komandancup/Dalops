const PESAN_KODE: Record<string, string> = {
  'auth/network-request-failed': 'Tidak ada internet. Periksa sambungan lalu coba lagi.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
  unavailable: 'Tidak ada internet. Periksa sambungan lalu coba lagi.',
  'permission-denied': 'Akun ini tidak punya izin untuk itu.',
};

/**
 * Indonesian text for an error. Data functions already throw Indonesian messages; raw Firebase
 * errors (English, carrying a `code`) are mapped to a friendly sentence instead.
 */
export function pesanGalat(e: unknown): string {
  const kode = (e as { code?: unknown })?.code;
  if (typeof kode === 'string') return PESAN_KODE[kode] ?? 'Terjadi kesalahan. Coba lagi.';
  if (e instanceof Error && e.message && !e.message.startsWith('Firebase')) return e.message;
  return 'Terjadi kesalahan. Coba lagi.';
}
