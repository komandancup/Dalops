import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import type { Pengaturan } from '../types';

const PENGATURAN_AWAL: Pengaturan = { namaWarung: 'Warung Pecel Lele', qrisStatis: null, namaMerchant: null };

/** Shop settings; defaults until the owner saves them. */
export async function ambilPengaturan(db: Firestore): Promise<Pengaturan> {
  const snap = await getDoc(doc(db, 'pengaturan', 'warung'));
  if (!snap.exists()) return { ...PENGATURAN_AWAL };
  const d = snap.data();
  return { namaWarung: d.namaWarung, qrisStatis: d.qrisStatis ?? null, namaMerchant: d.namaMerchant ?? null };
}

export async function simpanPengaturan(db: Firestore, p: Pengaturan): Promise<void> {
  await setDoc(doc(db, 'pengaturan', 'warung'), {
    namaWarung: p.namaWarung, qrisStatis: p.qrisStatis, namaMerchant: p.namaMerchant,
  });
}
