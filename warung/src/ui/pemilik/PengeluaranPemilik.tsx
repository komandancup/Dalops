import { useState } from 'react';
import { db } from '../../firebase';
import { batalkanPengeluaran } from '../../data/pengeluaran';
import { jamWIB, tanggalWIB } from '../../lib/tanggal';
import { formatRupiah } from '../../lib/uang';
import type { Pengeluaran, Pengguna } from '../../types';
import Batalkan from '../Batalkan';
import Tombol from '../komponen/Tombol';
import { FormPengeluaran } from '../Pengeluaran';
import { LayarGalat, LayarMemuat } from '../Status';
import { rentangPreset } from './PilihRentang';
import { usePeriode } from './usePeriode';

/** Expenses the owner paid personally, outside any cash session (never from the drawer). */
export default function PengeluaranPemilik({ pengguna }: { pengguna: Pengguna }) {
  const pelaku = { uid: pengguna.uid, nama: pengguna.nama };
  const [{ dari, sampai }] = useState(() => rentangPreset('bulan'));
  const periode = usePeriode(dari, sampai);
  const [kabar, setKabar] = useState<string | null>(null);
  const [batal, setBatal] = useState<Pengeluaran | null>(null);

  const daftar = periode.data?.pengeluaran
    .filter((e) => e.sesiKasId === null)
    .sort((a, b) => b.dibuatPada.getTime() - a.dibuatPada.getTime());

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 pt-0">
      <h2 className="text-2xl font-bold text-stone-900">Pengeluaran Pemilik</h2>
      <p className="-mt-2 text-base text-stone-700">Untuk belanja yang Anda bayar sendiri, bukan dari laci kas.</p>
      <FormPengeluaran pelaku={pelaku} sesiKasId={null} onTersimpan={periode.muatUlang} />

      <section className="flex flex-col gap-2">
        <h3 className="text-xl font-bold text-stone-900">Bulan ini</h3>
        {kabar && <p role="status" className="rounded-xl bg-green-800 p-3 text-center text-base font-medium text-white">{kabar}</p>}
        {periode.galat ? (
          <LayarGalat pesan={periode.galat} onCobaLagi={periode.muatUlang} />
        ) : !daftar ? (
          <LayarMemuat />
        ) : daftar.length === 0 ? (
          <p className="p-4 text-center text-lg text-stone-700">Belum ada pengeluaran pemilik bulan ini.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {daftar.map((e) => (
              <li key={e.id} className={`rounded-xl border border-stone-200 p-3 ${e.status === 'batal' ? 'bg-stone-100' : 'bg-white'}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate text-lg font-bold text-stone-900">{e.kategori}</p>
                  <p className={`whitespace-nowrap text-lg font-bold ${e.status === 'batal' ? 'text-stone-500 line-through' : 'text-stone-900'}`}>
                    {formatRupiah(e.nominal)}
                  </p>
                </div>
                {e.keterangan && <p className="text-base text-stone-800">{e.keterangan}</p>}
                <p className="text-sm text-stone-700">{tanggalWIB(e.dibuatPada)} {jamWIB(e.dibuatPada)}</p>
                {e.status === 'batal' ? (
                  <p className="text-sm text-red-800">Dibatalkan {e.dibatalkanOleh?.nama ?? ''}: {e.alasanBatal}</p>
                ) : (
                  <Tombol onClick={() => { setKabar(null); setBatal(e); }} jenis="batal" className="mt-2 w-full">Batalkan</Tombol>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {batal && (
        <Batalkan
          judul="Batalkan Pengeluaran"
          tombol="Batalkan Pengeluaran"
          onBatalkan={async (alasan) => {
            await batalkanPengeluaran(db, pelaku, batal.id, alasan);
            setBatal(null);
            setKabar(`Pengeluaran ${batal.kategori} ${formatRupiah(batal.nominal)} dibatalkan.`);
            periode.muatUlang();
          }}
          onTutup={() => setBatal(null)}
        >
          {batal.kategori} · {formatRupiah(batal.nominal)}{batal.keterangan && ` · ${batal.keterangan}`}
        </Batalkan>
      )}
    </div>
  );
}
