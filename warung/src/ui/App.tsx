import { useEffect, useState, type ReactNode } from 'react';
import { auth, db } from '../firebase';
import { keluar, pantauPengguna } from '../data/auth';
import { ambilPengaturan } from '../data/pengaturan';
import { pantauSesiAktif } from '../data/sesi';
import type { Pengguna, SesiKas } from '../types';
import BukaKas from './BukaKas';
import DaftarPesanan from './DaftarPesanan';
import { pesanGalat } from './galat';
import Kasir from './Kasir';
import Kerangka, { tabAwal, type Tab } from './Kerangka';
import Masuk from './Masuk';
import Pengeluaran from './Pengeluaran';
import { LayarGalat, LayarMemuat, SegeraHadir } from './Status';
import TutupKas from './TutupKas';

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

  // Every session-bound tab waits for the session listener and shares its error state.
  const isiSesi = (isi: (s: SesiKas | null) => ReactNode) => {
    if (galatSesi) return <LayarGalat pesan={galatSesi} onCobaLagi={() => setMuatKe((n) => n + 1)} />;
    if (sesi === undefined) return <LayarMemuat />;
    return isi(sesi);
  };

  // Kasir stays mounted while other tabs are shown so a half-built cart survives a tab switch.
  const kasir = isiSesi((s) => (s ? <Kasir key={s.id} pengguna={pengguna} sesi={s} /> : <BukaKas pengguna={pengguna} />));
  let lain: ReactNode = null;
  if (tab === 'pesanan') lain = isiSesi((s) => <DaftarPesanan pengguna={pengguna} sesi={s} namaWarung={namaWarung} />);
  else if (tab === 'pengeluaran') lain = isiSesi((s) => <Pengeluaran pengguna={pengguna} sesi={s} />);
  else if (tab === 'tutup') lain = isiSesi((s) => <TutupKas pengguna={pengguna} sesi={s} />);
  else if (tab === 'beranda') lain = <SegeraHadir judul="Beranda" />;
  else if (tab === 'lainnya') lain = <SegeraHadir judul="Lainnya" />;

  return (
    <Kerangka namaWarung={namaWarung} pengguna={pengguna} tab={tab} onTab={setTab} onKeluar={() => void keluar(auth).catch(() => {})}>
      <div hidden={tab !== 'kasir'} className="min-h-full">{kasir}</div>
      {lain}
    </Kerangka>
  );
}
