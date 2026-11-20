import { useState } from 'react';
import { auth } from '../firebase';
import { masuk } from '../data/auth';
import { pesanGalat } from './galat';
import Tombol from './komponen/Tombol';

const GAYA_INPUT = 'min-h-12 rounded-xl border-2 border-stone-300 bg-white px-3 text-lg outline-none focus:border-orange-700';

/** `alasan`: why the app just signed this account out (e.g. deactivated), shown until a new error replaces it. */
export default function Masuk({ alasan = null }: { alasan?: string | null }) {
  const [username, setUsername] = useState('');
  const [sandi, setSandi] = useState('');
  const [galat, setGalat] = useState<string | null>(null);

  async function kirim() {
    setGalat(null);
    try {
      await masuk(auth, username, sandi);
    } catch (e) {
      setGalat(pesanGalat(e));
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-4">
      <h1 className="text-center text-3xl font-extrabold text-stone-900">Warung</h1>
      <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
        <label className="flex flex-col gap-1 text-base font-medium text-stone-800">
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off"
            autoComplete="username" spellCheck={false} className={GAYA_INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-base font-medium text-stone-800">
          Kata sandi
          <input type="password" value={sandi} onChange={(e) => setSandi(e.target.value)} autoComplete="current-password"
            className={GAYA_INPUT} />
        </label>
        {(galat ?? alasan) && <p role="alert" className="text-base font-medium text-red-800">{galat ?? alasan}</p>}
        <Tombol type="submit" onClick={kirim} disabled={username.trim() === '' || sandi === ''} className="min-h-14 text-xl">
          Masuk
        </Tombol>
      </form>
    </main>
  );
}
