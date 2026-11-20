import { useState } from 'react';
import { Plus } from 'lucide-react';
import { db } from '../../firebase';
import { buatKaryawan, nonaktifkanKaryawan, resetSandi } from '../../data/karyawan';
import { pantauSemuaPengguna } from '../../data/pengguna';
import { usernameValid } from '../../lib/username';
import type { Pengguna } from '../../types';
import { pesanGalat } from '../galat';
import Dialog from '../komponen/Dialog';
import Kolom from '../komponen/Kolom';
import Tombol from '../komponen/Tombol';
import { LayarGalat, LayarMemuat } from '../Status';
import { usePantau } from '../usePantau';

// Same wording as api/karyawanHandler.ts.
const MIN_SANDI = 6;
export const PESAN_SANDI = `Kata sandi minimal ${MIN_SANDI} karakter.`;
export const PESAN_USERNAME = 'Username hanya huruf kecil, angka, _ (3–20 karakter).';

type Aksi = { jenis: 'tambah' } | { jenis: 'reset' | 'nonaktif'; orang: Pengguna };

export default function Karyawan() {
  const orang = usePantau<Pengguna[]>((cb, onError) => pantauSemuaPengguna(db, cb, onError), 'users');
  const [aksi, setAksi] = useState<Aksi | null>(null);
  const [kabar, setKabar] = useState<string | null>(null);
  const tutup = () => setAksi(null);

  if (orang.galat) return <LayarGalat pesan={orang.galat} onCobaLagi={orang.cobaLagi} />;
  if (!orang.data) return <LayarMemuat />;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h2 className="text-2xl font-bold text-stone-900">Karyawan</h2>
      {kabar && <p role="status" className="rounded-xl bg-green-800 p-3 text-center text-base font-medium text-white">{kabar}</p>}
      <ul className="flex flex-col gap-2">
        {orang.data.map((p) => (
          <li key={p.uid} className={`flex flex-col gap-2 rounded-xl border border-stone-200 p-3 ${p.aktif ? 'bg-white' : 'bg-stone-100'}`}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 truncate text-lg font-bold text-stone-900">{p.nama}</p>
              <p className={`whitespace-nowrap text-base font-semibold ${p.aktif ? 'text-green-800' : 'text-red-800'}`}>
                {p.peran === 'pemilik' ? 'Pemilik' : p.aktif ? 'Aktif' : 'Nonaktif'}
              </p>
            </div>
            <p className="text-base text-stone-800">{p.username}</p>
            {p.peran === 'karyawan' && p.aktif && (
              <div className="grid grid-cols-2 gap-2">
                <Tombol jenis="kedua" onClick={() => { setKabar(null); setAksi({ jenis: 'reset', orang: p }); }}>Reset sandi</Tombol>
                <Tombol jenis="batal" onClick={() => { setKabar(null); setAksi({ jenis: 'nonaktif', orang: p }); }}>Nonaktifkan</Tombol>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Tombol jenis="kedua" onClick={() => { setKabar(null); setAksi({ jenis: 'tambah' }); }} className="flex items-center justify-center gap-2">
        <Plus aria-hidden className="size-5" /> Tambah Karyawan
      </Tombol>

      {aksi?.jenis === 'tambah' && (
        <FormTambah onTutup={tutup} onSelesai={(n) => { tutup(); setKabar(`Akun ${n} dibuat.`); }} />
      )}
      {aksi?.jenis === 'reset' && (
        <FormReset orang={aksi.orang} onTutup={tutup} onSelesai={() => { tutup(); setKabar(`Kata sandi ${aksi.orang.nama} diganti.`); }} />
      )}
      {aksi?.jenis === 'nonaktif' && (
        <FormNonaktif orang={aksi.orang} onTutup={tutup} onSelesai={() => { tutup(); setKabar(`Akun ${aksi.orang.nama} dinonaktifkan.`); }} />
      )}
    </div>
  );
}

/** Runs a save with an in-flight lock and an Indonesian error. */
function useKirim(onSelesai: () => void) {
  const [galat, setGalat] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  async function kirim(kerja: () => Promise<void>) {
    setGalat(null);
    setMenyimpan(true);
    try {
      await kerja();
      onSelesai();
    } catch (e) {
      setGalat(pesanGalat(e));
      setMenyimpan(false);
    }
  }
  return { galat, setGalat, menyimpan, kirim };
}

function FormTambah({ onTutup, onSelesai }: { onTutup(): void; onSelesai(nama: string): void }) {
  const [nama, setNama] = useState('');
  const [username, setUsername] = useState('');
  const [sandi, setSandi] = useState('');
  const [sentuh, setSentuh] = useState({ username: false, sandi: false });
  const { galat, menyimpan, kirim } = useKirim(() => onSelesai(nama.trim()));
  const uname = username.trim().toLowerCase();
  const galatUsername = uname !== '' && !usernameValid(uname) ? PESAN_USERNAME : null;
  const galatSandi = sandi !== '' && sandi.length < MIN_SANDI ? PESAN_SANDI : null;
  const siap = nama.trim() !== '' && usernameValid(uname) && sandi.length >= MIN_SANDI;

  return (
    <Dialog judul="Tambah Karyawan" onTutup={onTutup} kunci={menyimpan}>
      <div className="flex flex-col gap-4">
        <Kolom label="Nama" value={nama} onChange={setNama} autoComplete="off" />
        <Kolom label="Username" value={username} onChange={setUsername} autoComplete="off" autoCapitalize="none" spellCheck={false}
          onBlur={() => setSentuh((s) => ({ ...s, username: true }))}
          keterangan={sentuh.username && galatUsername ? galatUsername : 'Dipakai untuk masuk. Huruf kecil, angka, _.'} />
        <Kolom label="Kata sandi" value={sandi} onChange={setSandi} autoComplete="new-password" type="text" spellCheck={false}
          onBlur={() => setSentuh((s) => ({ ...s, sandi: true }))}
          keterangan={sentuh.sandi && galatSandi ? galatSandi : 'Minimal 6 karakter.'} />
        {galat && <p role="alert" className="text-base font-medium text-red-800">{galat}</p>}
        <Tombol disabled={!siap} className="min-h-14 text-xl"
          onClick={() => kirim(async () => { await buatKaryawan(nama.trim(), uname, sandi); })}>
          Buat Akun
        </Tombol>
      </div>
    </Dialog>
  );
}

function FormReset({ orang, onTutup, onSelesai }: { orang: Pengguna; onTutup(): void; onSelesai(): void }) {
  const [sandi, setSandi] = useState('');
  const { galat, menyimpan, kirim } = useKirim(onSelesai);
  return (
    <Dialog judul={`Reset sandi ${orang.nama}`} onTutup={onTutup} kunci={menyimpan}>
      <div className="flex flex-col gap-4">
        <Kolom label="Kata sandi baru" value={sandi} onChange={setSandi} autoComplete="new-password" spellCheck={false}
          keterangan={sandi !== '' && sandi.length < MIN_SANDI ? PESAN_SANDI : 'Minimal 6 karakter.'} />
        {galat && <p role="alert" className="text-base font-medium text-red-800">{galat}</p>}
        <Tombol disabled={sandi.length < MIN_SANDI} className="min-h-14 text-xl" onClick={() => kirim(() => resetSandi(orang.uid, sandi))}>
          Ganti Kata Sandi
        </Tombol>
      </div>
    </Dialog>
  );
}

function FormNonaktif({ orang, onTutup, onSelesai }: { orang: Pengguna; onTutup(): void; onSelesai(): void }) {
  const [ketik, setKetik] = useState('');
  const { galat, menyimpan, kirim } = useKirim(onSelesai);
  return (
    <Dialog judul={`Nonaktifkan ${orang.nama}`} onTutup={onTutup} kunci={menyimpan}>
      <div className="flex flex-col gap-4">
        <p className="text-base text-stone-800">
          {orang.nama} tidak akan bisa masuk lagi. Riwayat pesanannya tetap tersimpan. Ketik nama karyawan untuk melanjutkan.
        </p>
        <Kolom label={`Ketik nama: ${orang.nama}`} value={ketik} onChange={setKetik} autoComplete="off" />
        {galat && <p role="alert" className="text-base font-medium text-red-800">{galat}</p>}
        <Tombol jenis="bahaya" disabled={ketik !== orang.nama} className="min-h-14 text-xl" onClick={() => kirim(() => nonaktifkanKaryawan(orang.uid))}>
          Nonaktifkan Akun
        </Tombol>
      </div>
    </Dialog>
  );
}
