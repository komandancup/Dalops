import jsQR from 'jsqr';

/** Teks kode QR dari piksel RGBA, atau null bila tidak terbaca. */
export function bacaQrDariPiksel(data: Uint8ClampedArray, lebar: number, tinggi: number): string | null {
  return jsQR(data, lebar, tinggi)?.data ?? null;
}

const SISI_MAKS = 1600;

/** Browser only: menggambar file gambar ke canvas lalu membaca kode QR-nya. */
export async function bacaQrDariFile(f: File): Promise<string | null> {
  const bmp = await createImageBitmap(f);
  try {
    const skala = Math.min(1, SISI_MAKS / Math.max(bmp.width, bmp.height));
    const lebar = Math.max(1, Math.round(bmp.width * skala));
    const tinggi = Math.max(1, Math.round(bmp.height * skala));
    const canvas = document.createElement('canvas');
    canvas.width = lebar;
    canvas.height = tinggi;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, lebar, tinggi);
    const { data } = ctx.getImageData(0, 0, lebar, tinggi);
    return bacaQrDariPiksel(data, lebar, tinggi);
  } finally {
    bmp.close();
  }
}
