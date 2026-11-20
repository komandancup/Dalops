import { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { keluar, pantauPengguna } from '../data/auth';
import { ambilPengaturan } from '../data/pengaturan';
import { pantauSesiAktif } from '../data/sesi';
import type { Pengguna, SesiKas } from '../types';
import BukaKas from './BukaKas';
import { pesanGalat } from './galat';
import Kasir from './Kasir';
import Kerangka, { tabAwal, type Tab } from './Kerangka';
import Masuk from './Masuk';
import { LayarGalat, LayarMemuat, SegeraHadir } from './Status';

const JUDUL: Record<Exclude<Tab, 'kasir'>, string> = {
  beranda: 'Beranda', pesanan: 'Pesanan', pengeluaran: 'Pengeluaran', tutup: 'Tutup Kas', lainnya: 'Lainnya',
};

export default function App() {
  const [pengguna, setPengguna] = useState<Pengguna | null | undefined>(undefined);
  const [alasanKeluar, setAlasanKeluar] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [muatKe, setMuatKe] = useState(0);

  useEffect(() => {
    setGalat(null);
    setPengguna(undefined);
    return pantauPengguna(
      auth, db,
      (p, info) => {
        setPengguna(p);
        if (p) setAlasanKeluar(null);
        else if (info) setAlasanKeluar(info.alasan); // a plain null (the sign-out itself) keeps the reason
      },
      (e) => {
        console.error('pantauPengguna:', e);
        setGalat(pesanGalat(e));
      },
    );
  }, [muatKe]);

  // While signed in a dead profile listener is only logged: kicking the cashier out mid-order is worse.
  if (galat && !pengguna) return <LayarGalat pesan={galat} onCobaLagi={() => setMuatKe((n) => n + 1)} />;
  if (pengguna === undefined) return <LayarMemuat />;
  if (pengguna === null) return <Masuk alasan={alasanKeluar} />;
  return <Utama key={pengguna.uid} pengguna={pengguna} />;
}

function Utama({ pengguna }: { pengguna: Pengguna }) {
  const [tab, setTab] = useState<Tab>(tabAwal(pengguna.peran));
  const [namaWarung, setNamaWarung] = useState('Warung');
  const [sesi, setSesi] = useState<SesiKas | null | undefined>(undefined);
  const [galatSesi, setGalatSesi] = useState<string | null>(null);
  const [muatKe, setMuatKe] = useState(0);

  useEffect(() => {
    ambilPengaturan(db).then((p) => setNamaWarung(p.namaWarung)).catch(() => {}); // header falls back to "Warung"
  }, []);

  useEffect(() => {
    setGalatSesi(null);
    setSesi(undefined);
    return pantauSesiAktif(db, setSesi, (e) => setGalatSesi(pesanGalat(e)));
  }, [muatKe]);

  // Kasir stays mounted while other tabs are shown so a half-built cart survives a tab switch.
  let kasir;
  if (galatSesi) kasir = <LayarGalat pesan={galatSesi} onCobaLagi={() => setMuatKe((n) => n + 1)} />;
  else if (sesi === undefined) kasir = <LayarMemuat />;
  else if (sesi === null) kasir = <BukaKas pengguna={pengguna} />;
  else kasir = <Kasir key={sesi.id} pengguna={pengguna} sesi={sesi} />;

  return (
    <Kerangka namaWarung={namaWarung} pengguna={pengguna} tab={tab} onTab={setTab} onKeluar={() => void keluar(auth).catch(() => {})}>
      <div hidden={tab !== 'kasir'} className="min-h-full">{kasir}</div>
      {tab !== 'kasir' && <SegeraHadir judul={JUDUL[tab]} />}
    </Kerangka>
  );
}
