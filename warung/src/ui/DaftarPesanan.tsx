import { useState } from 'react';
import { db } from '../firebase';
import { batalkanPesanan, lunasiPesanan, pantauPesananSesi } from '../data/pesanan';
import { formatRupiah } from '../lib/uang';
import { bolehCetak, cetakPesanan } from '../printer/printer';
import type { Pengguna, Pesanan, SesiKas, StatusPesanan } from '../types';
import Bayar from './Bayar';
import Batalkan from './Batalkan';
import { pesanGalat } from './galat';
import Tombol from './komponen/Tombol';
import { KasBelumDibuka, LayarGalat, LayarMemuat } from './Status';
import { usePantau } from './usePantau';

const TAB: { status: StatusPesanan; teks: string }[] = [
  { status: 'belum_bayar', teks: 'Belum bayar' },
  { status: 'lunas', teks: 'Lunas' },
  { status: 'batal', teks: 'Batal' },
];

interface Props { pengguna: Pengguna; sesi: SesiKas | null; namaWarung: string }

export default function DaftarPesanan({ sesi, ...props }: Props) {
  if (!sesi) return <KasBelumDibuka />;
  return <Daftar key={sesi.id} sesi={sesi} {...props} />;
}

function Daftar({ pengguna, sesi, namaWarung }: Props & { sesi: SesiKas }) {
  const pelaku = { uid: pengguna.uid, nama: pengguna.nama };
  const { data, galat: galatMuat, cobaLagi } = usePantau<Pesanan[]>(
    (cb, onError) => pantauPesananSesi(db, sesi.id, cb, onError), sesi.id,
  );
  const [tab, setTab] = useState<StatusPesanan>('belum_bayar');
  const [bayar, setBayar] = useState<Pesanan | null>(null);
  const [batal, setBatal] = useState<Pesanan | null>(null);
  const [kabar, setKabar] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  if (galatMuat) return <LayarGalat pesan={galatMuat} onCobaLagi={cobaLagi} />;
  if (!data) return <LayarMemuat />;

  // Unpaid orders oldest first (a queue); paid and cancelled newest first.
  const isi = data.filter((p) => p.status === tab);
  if (tab !== 'belum_bayar') isi.reverse();

  const lapor = (k: string | null, g: string | null) => {
    setKabar(k);
    setGalat(g);
  };

  async function cetak(p: Pesanan) {
    lapor(null, null);
    try {
      await cetakPesanan(p, namaWarung);
    } catch (e) {
      lapor(null, pesanGalat(e));
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-3 p-3">
      <div role="tablist" aria-label="Status pesanan" className="grid grid-cols-3 gap-1 rounded-xl bg-stone-200 p-1">
        {TAB.map(({ status, teks }) => (
          <button key={status} type="button" role="tab" aria-selected={tab === status}
            onClick={() => { setTab(status); lapor(null, null); }}
            className={`flex min-h-12 flex-col items-center justify-center rounded-lg px-1 py-1 text-base font-semibold leading-tight ${
              tab === status ? 'bg-white text-orange-800 shadow-sm' : 'text-stone-700'
            }`}>
            <span>{teks}</span> <span>({data.filter((p) => p.status === status).length})</span>
          </button>
        ))}
      </div>

      {kabar && <p role="status" className="rounded-xl bg-green-800 p-3 text-center text-base font-medium text-white">{kabar}</p>}
      {galat && <p role="alert" className="text-base font-medium text-red-800">{galat}</p>}

      {isi.length === 0 && (
        <p className="p-6 text-center text-lg text-stone-700">
          {tab === 'belum_bayar' ? 'Tidak ada pesanan yang belum bayar.' : tab === 'lunas' ? 'Belum ada pesanan lunas.' : 'Tidak ada pesanan batal.'}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {isi.map((p) => (
          <li key={p.id} className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 truncate text-xl font-bold text-stone-900">
                #{p.nomor}{p.label && <span className="font-semibold"> · {p.label}</span>}
              </p>
              <p className="whitespace-nowrap text-xl font-bold text-stone-900">{formatRupiah(p.total)}</p>
            </div>
            <p className="text-base text-stone-800">{p.item.map((i) => `${i.jumlah}× ${i.nama}`).join(', ')}</p>
            <p className="text-sm text-stone-700">
              {p.caraBayar === 'qris' ? 'QRIS' : p.caraBayar === 'tunai' ? 'Tunai' : 'Belum bayar'} · Dicatat {p.dibuatOleh.nama}
            </p>
            {p.status === 'batal' && (
              <p className="text-sm text-red-800">Dibatalkan {p.dibatalkanOleh?.nama ?? ''}: {p.alasanBatal}</p>
            )}
            {p.status !== 'batal' && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {p.status === 'belum_bayar' && (
                  <Tombol onClick={() => { lapor(null, null); setBayar(p); }}>Bayar</Tombol>
                )}
                {bolehCetak(p) && (
                  <Tombol onClick={() => cetak(p)} jenis="kedua">{p.jumlahCetak > 0 ? 'Cetak ulang' : 'Cetak struk'}</Tombol>
                )}
                <Tombol onClick={() => { lapor(null, null); setBatal(p); }} jenis="batal">Batalkan</Tombol>
              </div>
            )}
          </li>
        ))}
      </ul>

      {bayar && (
        <Bayar
          total={bayar.total}
          judul={`Bayar Pesanan #${bayar.nomor}`}
          onBayar={async (b) => {
            await lunasiPesanan(db, pelaku, bayar.id, b.caraBayar, b.uangDiterima);
            setBayar(null);
            lapor(`Pesanan #${bayar.nomor} lunas.`, null);
          }}
          onTutup={() => setBayar(null)}
        />
      )}
      {batal && (
        <Batalkan
          judul={`Batalkan Pesanan #${batal.nomor}`}
          tombol="Batalkan Pesanan"
          onBatalkan={async (alasan) => {
            await batalkanPesanan(db, pelaku, batal.id, alasan);
            setBatal(null);
            lapor(`Pesanan #${batal.nomor} dibatalkan.`, null);
          }}
          onTutup={() => setBatal(null)}
        >
          {batal.label ? `${batal.label} · ` : ''}{formatRupiah(batal.total)}
          {batal.status === 'lunas' && (
            <p className="mt-1 text-base text-stone-700">Kalau sudah dibayar, kembalikan uangnya ke pembeli.</p>
          )}
        </Batalkan>
      )}
    </div>
  );
}
