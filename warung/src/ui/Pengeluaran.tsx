import { useId, useState } from 'react';
import { db } from '../firebase';
import { batalkanPengeluaran, catatPengeluaran, pantauPengeluaranSesi } from '../data/pengeluaran';
import { formatRupiah } from '../lib/uang';
import type { KategoriPengeluaran, Pelaku, Pengeluaran as DataPengeluaran, Pengguna, SesiKas } from '../types';
import Batalkan from './Batalkan';
import { pesanGalat } from './galat';
import InputRupiah from './komponen/InputRupiah';
import Tombol from './komponen/Tombol';
import { KasBelumDibuka, LayarGalat, LayarMemuat } from './Status';
import { usePantau } from './usePantau';

const KATEGORI: KategoriPengeluaran[] = ['Bahan baku', 'Minyak', 'Gas', 'Beras', 'Kemasan', 'Operasional lain'];

export default function Pengeluaran({ pengguna, sesi }: { pengguna: Pengguna; sesi: SesiKas | null }) {
  if (!sesi) return <KasBelumDibuka />;
  return <HalamanPengeluaran key={sesi.id} pengguna={pengguna} sesi={sesi} />;
}

function HalamanPengeluaran({ pengguna, sesi }: { pengguna: Pengguna; sesi: SesiKas }) {
  const pelaku = { uid: pengguna.uid, nama: pengguna.nama };
  const daftar = usePantau<DataPengeluaran[]>((cb, onError) => pantauPengeluaranSesi(db, sesi.id, cb, onError), sesi.id);
  const [kabar, setKabar] = useState<string | null>(null);
  const [batal, setBatal] = useState<DataPengeluaran | null>(null);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h2 className="text-2xl font-bold text-stone-900">Catat pengeluaran</h2>
      <FormPengeluaran pelaku={pelaku} sesiKasId={sesi.id} />

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-stone-900">Pengeluaran hari ini</h2>
        {kabar && <p role="status" className="rounded-xl bg-green-800 p-3 text-center text-base font-medium text-white">{kabar}</p>}
        {daftar.galat ? (
          <LayarGalat pesan={daftar.galat} onCobaLagi={daftar.cobaLagi} />
        ) : !daftar.data ? (
          <LayarMemuat />
        ) : daftar.data.length === 0 ? (
          <p className="p-4 text-center text-lg text-stone-700">Belum ada pengeluaran.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {daftar.data.map((e) => (
              <li key={e.id} className={`rounded-xl border border-stone-200 p-3 ${e.status === 'batal' ? 'bg-stone-100' : 'bg-white'}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate text-lg font-bold text-stone-900">{e.kategori}</p>
                  <p className={`whitespace-nowrap text-lg font-bold ${e.status === 'batal' ? 'text-stone-500 line-through' : 'text-stone-900'}`}>
                    {formatRupiah(e.nominal)}
                  </p>
                </div>
                {e.keterangan && <p className="text-base text-stone-800">{e.keterangan}</p>}
                <p className="text-sm text-stone-700">{e.dariLaci ? 'Dari laci' : 'Bukan dari laci'} · Dicatat {e.dibuatOleh.nama}</p>
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
          }}
          onTutup={() => setBatal(null)}
        >
          {batal.kategori} · {formatRupiah(batal.nominal)}{batal.keterangan && ` · ${batal.keterangan}`}
        </Batalkan>
      )}
    </div>
  );
}

interface PropsForm {
  pelaku: Pelaku;
  /** null = an owner expense outside any cash session: no drawer toggle, never from the drawer. */
  sesiKasId: string | null;
  onTersimpan?(): void;
}

/** Category, amount, note and (inside a session) "Uang dari laci?". Shared by the session and owner screens. */
export function FormPengeluaran({ pelaku, sesiKasId, onTersimpan }: PropsForm) {
  const idKategori = useId();
  const idKeterangan = useId();
  const pakaiLaci = sesiKasId !== null;
  const [kategori, setKategori] = useState<KategoriPengeluaran | null>(null);
  const [nominal, setNominal] = useState<number | null>(null);
  const [keterangan, setKeterangan] = useState('');
  const [dariLaci, setDariLaci] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [kabar, setKabar] = useState<string | null>(null);

  async function simpan() {
    if (kategori === null || nominal === null) return;
    setGalat(null);
    setKabar(null);
    try {
      await catatPengeluaran(db, pelaku, { sesiKasId, kategori, keterangan, nominal, dariLaci: pakaiLaci && dariLaci });
      setKategori(null);
      setNominal(null);
      setKeterangan('');
      setDariLaci(true);
      setKabar(`Pengeluaran ${kategori} ${formatRupiah(nominal)} tersimpan.`);
      onTersimpan?.();
    } catch (e) {
      setGalat(pesanGalat(e));
    }
  }

  return (
    <>
      <div role="group" aria-labelledby={idKategori} className="flex flex-col gap-1">
        <p id={idKategori} className="text-base font-medium text-stone-800">Kategori</p>
        <div className="grid grid-cols-2 gap-2">
          {KATEGORI.map((k) => (
            <button key={k} type="button" aria-pressed={kategori === k} onClick={() => setKategori(k)}
              className={`min-h-12 rounded-xl border-2 px-2 text-base font-semibold ${
                kategori === k ? 'border-orange-700 bg-orange-50 text-orange-900' : 'border-stone-300 bg-white text-stone-900'
              }`}>
              {k}
            </button>
          ))}
        </div>
      </div>

      <InputRupiah label="Nominal" value={nominal} onChange={setNominal} />

      <div className="flex flex-col gap-1">
        <label htmlFor={idKeterangan} className="text-base font-medium text-stone-800">Keterangan</label>
        <input id={idKeterangan} value={keterangan} onChange={(e) => setKeterangan(e.target.value)} maxLength={200} placeholder="mis. lele 5 kg"
          className="min-h-12 rounded-xl border-2 border-stone-300 bg-white px-3 text-lg outline-none focus:border-orange-700" />
      </div>

      {pakaiLaci && (
        <button type="button" role="switch" aria-checked={dariLaci} onClick={() => setDariLaci((v) => !v)}
          className="flex min-h-14 items-center justify-between gap-3 rounded-xl border-2 border-stone-300 bg-white px-3 text-left">
          <span className="flex flex-col">
            <span className="text-base font-medium text-stone-800">Uang dari laci?</span>
            <span className="text-sm text-stone-700">{dariLaci ? 'Ya, diambil dari uang kas.' : 'Tidak, dibayar pakai uang lain.'}</span>
          </span>
          <span className={`flex h-8 w-14 shrink-0 items-center rounded-full p-1 ${dariLaci ? 'justify-end bg-orange-700' : 'justify-start bg-stone-400'}`}>
            <span className="size-6 rounded-full bg-white" />
          </span>
        </button>
      )}

      {galat && <p role="alert" className="text-base font-medium text-red-800">{galat}</p>}
      {kabar && <p role="status" className="rounded-xl bg-green-800 p-3 text-center text-base font-medium text-white">{kabar}</p>}
      <Tombol onClick={simpan} disabled={kategori === null || !nominal} className="min-h-14 text-xl">Simpan Pengeluaran</Tombol>
    </>
  );
}
