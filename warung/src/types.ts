export type Peran = 'pemilik' | 'karyawan';
export type CaraBayar = 'tunai' | 'qris';
export type StatusPesanan = 'belum_bayar' | 'lunas' | 'batal';
export interface Pelaku { uid: string; nama: string }
export interface Pengguna { uid: string; nama: string; username: string; peran: Peran; aktif: boolean }
export type KategoriMenu = 'Makanan' | 'Nasi & Tambahan' | 'Minuman';
export interface Menu { id: string; nama: string; harga: number; kategori: KategoriMenu; aktif: boolean; urutan: number }
export interface ItemPesanan { menuId: string; nama: string; harga: number; jumlah: number }
export interface Pesanan {
  id: string; sesiKasId: string; tanggal: string; nomor: number; label: string; catatan: string;
  item: ItemPesanan[]; total: number; status: StatusPesanan; caraBayar: CaraBayar | null; uangDiterima: number | null;
  jumlahCetak: number; dibuatOleh: Pelaku; dibuatPada: Date; dilunasiOleh: Pelaku | null; dilunasiPada: Date | null;
  dibatalkanOleh: Pelaku | null; dibatalkanPada: Date | null; alasanBatal: string | null;
}
export type KategoriPengeluaran = 'Bahan baku' | 'Minyak' | 'Gas' | 'Beras' | 'Kemasan' | 'Operasional lain';
export interface Pengeluaran {
  id: string; sesiKasId: string | null; tanggal: string; kategori: KategoriPengeluaran;
  keterangan: string; nominal: number; dariLaci: boolean; status: 'aktif' | 'batal'; dibuatOleh: Pelaku; dibuatPada: Date;
  dibatalkanOleh: Pelaku | null; dibatalkanPada: Date | null; alasanBatal: string | null;
}
export interface SesiKas {
  id: string; tanggal: string; status: 'buka' | 'tutup'; jumlahPesanan: number;
  dibukaOleh: Pelaku; dibukaPada: Date; modalAwal: number; modalSaran: number; alasanUbahModal: string | null;
  ditutupOleh: Pelaku | null; ditutupPada: Date | null; tunaiSeharusnya: number | null; tunaiDihitung: number | null;
  selisihTunai: number | null; qrisAplikasi: number | null; qrisMerchant: number | null; selisihQris: number | null;
  disetor: number | null; ditinggal: number | null; catatan: string | null;
}
export interface Koreksi { id: string; sesiKasId: string; tanggal: string; nominal: number; catatan: string; dibuatOleh: Pelaku; dibuatPada: Date }
export interface Pengaturan { namaWarung: string; qrisStatis: string | null; namaMerchant: string | null }
export interface SesiAktif { sesiKasId: string | null; ditinggalTerakhir: number }
