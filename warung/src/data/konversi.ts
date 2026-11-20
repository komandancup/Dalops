import type { DocumentSnapshot } from 'firebase/firestore';

/** Firestore Timestamp -> Date; anything else (null) passes through. */
export function keDate(v: unknown): Date | null {
  // Duck-typed so Timestamps from another SDK copy (e.g. the test environment) convert too.
  const ts = v as { toDate?: () => Date } | null;
  return ts && typeof ts.toDate === 'function' ? ts.toDate() : null;
}

/**
 * Reads a document as `T`: adds `id` and turns every `*Pada` field into a Date (or null).
 * Pending serverTimestamp() values are estimated locally so listeners never see null for a set time.
 */
export function dariDoc<T>(snap: DocumentSnapshot): T {
  const data = snap.data({ serverTimestamps: 'estimate' }) ?? {};
  const hasil: Record<string, unknown> = { id: snap.id };
  for (const [k, v] of Object.entries(data)) {
    hasil[k] = k.endsWith('Pada') ? keDate(v) : v;
  }
  return hasil as T;
}
