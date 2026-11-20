import { auth } from '../firebase';

async function kirim(body: Record<string, unknown>): Promise<string | undefined> {
  const user = auth.currentUser;
  if (!user) throw new Error('Silakan masuk dulu.');
  const token = await user.getIdToken();
  const res = await fetch('/api/karyawan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; pesan?: string; uid?: string };
  if (!res.ok || !data.ok) throw new Error(data.pesan ?? 'Gagal. Coba lagi.');
  return data.uid;
}

export async function buatKaryawan(nama: string, username: string, password: string): Promise<string> {
  return (await kirim({ aksi: 'buat', nama, username, password })) as string;
}
export async function resetSandi(uid: string, password: string): Promise<void> {
  await kirim({ aksi: 'reset', uid, password });
}
export async function nonaktifkanKaryawan(uid: string): Promise<void> {
  await kirim({ aksi: 'nonaktifkan', uid });
}
