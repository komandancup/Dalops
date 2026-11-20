# Warung Pecel Lele — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first web app, wrapped as an Android app, that records orders (cash and dynamic QRIS), expenses, shift cash sessions and receipts for one warung. The owner (an investor who is rarely on site) gets trustworthy numbers that cannot be silently erased.

**Architecture:** A standalone Vite + React + TypeScript project in `warung/`. All money, QRIS, receipt and report logic lives in pure modules under `src/lib/`, covered by unit tests. Firestore holds the data. The "trustworthy numbers" guarantees are enforced in `firestore.rules`, tested against the Firebase emulator. A thin data layer (`src/data/`) wraps Firestore calls. Account management that needs admin rights runs as one Vercel serverless function (`api/karyawan.ts`). Capacitor wraps the deployed Vercel URL as an Android app and supplies native Bluetooth printing.

**Tech Stack:** React 19, Vite 6, TypeScript 5.8, Tailwind 4, Firebase JS SDK 12 (Auth + Firestore), firebase-admin (Vercel function only), Vitest, @firebase/rules-unit-testing, firebase-tools (emulator), qrcode, jsqr, Capacitor 8, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-20-warung-pecel-lele-design.md` (approved). Read it before starting any task.

## Global Constraints

- Everything lives in `warung/`, with its own `package.json`. Do not touch the SiOps files at the repo root.
- Do not push to GitHub (no access). Commit locally only.
- All UI copy is in everyday Indonesian, with no accounting jargon.
- Money is a Rupiah **integer**, never a float. Display it as `Rp 15.000` (dot thousands separator, no decimals).
- Time zone is `Asia/Jakarta`. `tanggal` fields are `YYYY-MM-DD` in WIB.
- Payment methods are exactly `tunai` and `qris`. There is no transfer and no kasbon.
- Nothing ever deletes `pesanan`, `pengeluaran`, `sesiKas` or `koreksi` (no delete code paths; rules deny delete).
- Login is username + password. The synthetic email is `<username>@warung.app`. No Google login.
- Mobile-first: target a 360px-wide screen, tap targets ≥ 48px, high contrast.
- Firestore region is `asia-southeast2`. Free tiers only (Firebase Spark, Vercel Hobby).
- QRIS logic is reimplemented from verssache/qris-dinamis (MIT), with attribution in the file header. It is not added as a dependency.

## Review Focus

1. **Two phones press "Buka kas" at the same moment.** Exactly one session opens. The other phone sees the session that already exists. *Test: Task 6 `rules: second open session is denied`, Task 7 `bukaSesi twice returns existing session`.*
2. **Double tap on "Simpan" / "Tandai lunas".** A paid order cannot be marked paid again, and a double tap does not create duplicate orders. *Test: Task 6 `rules: lunas → lunas is denied`. Task 9 disables the button while a save is in flight.*
3. **Rupiah typed as `15.000`, `15000`, `Rp15.000`, or left blank.** Parsed to 15000. Blank or garbage is rejected with a clear message, never saved as NaN. *Test: Task 1 `parseRupiah`.*
4. **A session that runs past midnight.** Orders at 00:30 keep the session's `tanggal` (its open date), so the daily report does not split one shift. *Test: Task 7 `pesanan uses sesi tanggal, not clock date`.*
5. **The owner changes a menu price or deactivates an item while a cart holds it.** The order stores the price at the moment it is saved. Old orders never change. *Test: Task 3 `hitungTotal uses item harga snapshot`, Task 7 `buatPesanan copies nama and harga`.*

---

## File Structure

```
warung/
  package.json, tsconfig.json, vite.config.ts, vitest.config.ts, index.html
  .env.example                 VITE_FIREBASE_* keys, WARUNG_URL
  firebase.json, .firebaserc   emulator + rules deploy config
  firestore.rules              trust guarantees (Task 6)
  capacitor.config.ts          server.url = WARUNG_URL (Task 14)
  vercel.json                  SPA rewrite (Task 14)
  api/karyawan.ts              create/reset/deactivate employee via firebase-admin (Task 8)
  api/karyawanHandler.ts       pure handler with injected deps (Task 8)
  src/
    main.tsx, App.tsx, index.css
    types.ts                   shared domain types (Task 3)
    lib/uang.ts                formatRupiah, parseRupiah (Task 1)
    lib/tanggal.ts             tanggalWIB, jamWIB (Task 1)
    lib/qris.ts                CRC16, TLV parse, convert, validate (Task 2)
    lib/kas.ts                 totals, session summary, close validation (Task 3)
    lib/rekap.ts               period report, top menu, alerts, CSV (Task 4)
    lib/struk.ts               receipt lines + ESC/POS bytes (Task 5)
    firebase.ts                init from env; emulator switch (Task 7)
    data/*.ts                  Firestore read/write per collection (Tasks 7–8)
    printer/printer.ts         Bluetooth print + browser fallback (Task 14)
    ui/                        screens (Tasks 9–13)
  tests/
    lib/*.test.ts
    rules/*.test.ts            run under emulator
    data/*.test.ts             run under emulator
    api/karyawanHandler.test.ts
  README.md                    Indonesian setup guide for the owner (Task 14)
```

---

### Task 1: Project scaffold + money and date helpers

**Files:**
- Create: everything at the root of `warung/` listed above except `firestore.rules`, `capacitor.config.ts`, `vercel.json` and `api/`; also `src/main.tsx`, `src/App.tsx` (placeholder "Warung" heading), `src/index.css` (`@import "tailwindcss";`), `src/lib/uang.ts`, `src/lib/tanggal.ts`
- Test: `tests/lib/uang.test.ts`, `tests/lib/tanggal.test.ts`

**Interfaces:**
- Produces:
  - `formatRupiah(n: number): string`
  - `parseRupiah(s: string): number | null` (null = invalid or blank)
  - `tanggalWIB(d: Date): string`
  - `jamWIB(d: Date): string` (`HH:MM`)
- Scripts in package.json: `dev`, `build`, `lint` (`tsc --noEmit`), `test` (`vitest run tests/lib tests/api`), `test:emu` (`firebase emulators:exec --only auth,firestore "vitest run tests/rules tests/data"`)

- [ ] **Step 1: Scaffold.** Create the `warung/` project with the dependency versions used in the root SiOps `package.json` for react/vite/tailwind/firebase/capacitor/lucide-react. Add `vitest`, `@firebase/rules-unit-testing`, `firebase-tools`, `qrcode`, `@types/qrcode`, `jsqr` and `firebase-admin`. Run `npm install` in `warung/`.
- [ ] **Step 2: Write failing tests**

```ts
// tests/lib/uang.test.ts
expect(formatRupiah(15000)).toBe('Rp 15.000');
expect(formatRupiah(0)).toBe('Rp 0');
expect(formatRupiah(-2500)).toBe('-Rp 2.500');
expect(formatRupiah(1250000)).toBe('Rp 1.250.000');
expect(parseRupiah('15.000')).toBe(15000);
expect(parseRupiah('15000')).toBe(15000);
expect(parseRupiah('Rp15.000')).toBe(15000);
expect(parseRupiah(' Rp 15.000 ')).toBe(15000);
expect(parseRupiah('')).toBeNull();
expect(parseRupiah('abc')).toBeNull();
expect(parseRupiah('12,5')).toBeNull();
// tests/lib/tanggal.test.ts
expect(tanggalWIB(new Date('2026-11-20T17:30:00Z'))).toBe('2026-11-21'); // 00:30 WIB
expect(tanggalWIB(new Date('2026-11-20T16:59:00Z'))).toBe('2026-11-20');
expect(jamWIB(new Date('2026-11-20T17:30:00Z'))).toBe('00:30');
```

- [ ] **Step 3: Run** `cd warung && npx vitest run tests/lib`. Expected: FAIL (modules missing).
- [ ] **Step 4: Implement** `uang.ts` and `tanggal.ts`. Use `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' })` for dates. Do the thousands separator by hand, not through locale, so output is identical on every device.
- [ ] **Step 5: Run** `npx vitest run tests/lib && npm run lint && npm run build`. Expected: PASS, build succeeds.
- [ ] **Step 6: Commit** `git add warung && git commit -m "feat(warung): scaffold project with rupiah and WIB date helpers"`

---

### Task 2: QRIS dynamic conversion

**Files:**
- Create: `src/lib/qris.ts`
- Test: `tests/lib/qris.test.ts`

**Interfaces:**
- Produces:
  - `crc16(s: string): string` (4 uppercase hex chars; CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflection, no final XOR)
  - `parseTLV(s: string): { tag: string; value: string }[]` (throws `QrisError` on malformed length)
  - `validasiQris(s: string): { valid: boolean; namaMerchant?: string; alasan?: string }` (checks it starts with `000201`, has tag 58, and that the last 4 chars equal the CRC of everything before them; merchant name = tag 59)
  - `qrisDinamis(statis: string, nominal: number): string`
  - `class QrisError extends Error`

- [ ] **Step 1: Write failing tests.** Build a fixture in the test from parts: `000201` + `010211` + `2620` `0012ID.CO.QRIS.WWW` + ... (any merchant account template) + `5204` `5812` + `5303360` + `5802ID` + `5913WARUNG LELE 1` + `6007JAKARTA` + `6304` + `crc16(...)`. Then assert:

```ts
expect(crc16('123456789')).toBe('29B1');
expect(validasiQris(STATIS)).toEqual({ valid: true, namaMerchant: 'WARUNG LELE 1' });
expect(validasiQris(STATIS.slice(0, -1) + '0').valid).toBe(false); // broken CRC
const d = qrisDinamis(STATIS, 23000);
expect(d).toContain('010212');
expect(d).not.toContain('010211');
expect(d).toContain('540523000' + '5802ID'); // tag 54 inserted right before tag 58
expect(validasiQris(d).valid).toBe(true);
// already-dynamic input with an old amount: old 54 replaced, not duplicated
expect(parseTLV(qrisDinamis(d, 5000)).filter(e => e.tag === '54').length).toBe(1);
expect(qrisDinamis(d, 5000)).toContain('54045000' + '5802ID');
expect(() => qrisDinamis(TANPA_TAG_58, 1000)).toThrow(QrisError);
expect(() => qrisDinamis(STATIS, 0)).toThrow(QrisError);
expect(() => qrisDinamis(STATIS, 1500.5)).toThrow(QrisError);
expect(() => qrisDinamis(STATIS.slice(0, -1) + '0', 1000)).toThrow(QrisError); // refuses invalid input
```

- [ ] **Step 2: Run** `npx vitest run tests/lib/qris.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Port the algorithm from verssache/qris-dinamis `src/core/converter.ts`:
  - Parse the TLV.
  - Replace tag 01 with `12`.
  - Drop tags 54/55/56/57/63.
  - Insert `54` before `58`.
  - Rebuild, append `6304` and the CRC.

  No fee tags. Throw `QrisError` (Indonesian messages) for missing tag 58, a non-positive or non-integer amount, or an input that fails `validasiQris`. Add a file header: `// Diadaptasi dari verssache/qris-dinamis (MIT License, (c) 2020 QRIS Dinamis)`.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(warung): QRIS static-to-dynamic conversion`

---

### Task 3: Domain types and cash calculations

**Files:**
- Create: `src/types.ts`, `src/lib/kas.ts`
- Test: `tests/lib/kas.test.ts`

**Interfaces:**
- Produces (`src/types.ts`; field names exactly as in spec §7):

```ts
export type Peran = 'pemilik' | 'karyawan';
export type CaraBayar = 'tunai' | 'qris';
export type StatusPesanan = 'belum_bayar' | 'lunas' | 'batal';
export interface Pelaku { uid: string; nama: string }
export interface Pengguna { uid: string; nama: string; username: string; peran: Peran; aktif: boolean }
export interface Menu { id: string; nama: string; harga: number; kategori: KategoriMenu; aktif: boolean; urutan: number }
export type KategoriMenu = 'Makanan' | 'Nasi & Tambahan' | 'Minuman';
export interface ItemPesanan { menuId: string; nama: string; harga: number; jumlah: number }
export interface Pesanan { id: string; sesiKasId: string; tanggal: string; nomor: number; label: string; catatan: string;
  item: ItemPesanan[]; total: number; status: StatusPesanan; caraBayar: CaraBayar | null; uangDiterima: number | null;
  jumlahCetak: number; dibuatOleh: Pelaku; dibuatPada: Date; dilunasiOleh: Pelaku | null; dilunasiPada: Date | null;
  dibatalkanOleh: Pelaku | null; dibatalkanPada: Date | null; alasanBatal: string | null }
export type KategoriPengeluaran = 'Bahan baku' | 'Minyak' | 'Gas' | 'Beras' | 'Kemasan' | 'Operasional lain';
export interface Pengeluaran { id: string; sesiKasId: string | null; tanggal: string; kategori: KategoriPengeluaran;
  keterangan: string; nominal: number; dariLaci: boolean; status: 'aktif' | 'batal'; dibuatOleh: Pelaku; dibuatPada: Date;
  dibatalkanOleh: Pelaku | null; dibatalkanPada: Date | null; alasanBatal: string | null }
export interface SesiKas { id: string; tanggal: string; status: 'buka' | 'tutup'; jumlahPesanan: number;
  dibukaOleh: Pelaku; dibukaPada: Date; modalAwal: number; modalSaran: number; alasanUbahModal: string | null;
  ditutupOleh: Pelaku | null; ditutupPada: Date | null; tunaiSeharusnya: number | null; tunaiDihitung: number | null;
  selisihTunai: number | null; qrisAplikasi: number | null; qrisMerchant: number | null; selisihQris: number | null;
  disetor: number | null; ditinggal: number | null; catatan: string | null }
export interface Koreksi { id: string; sesiKasId: string; tanggal: string; nominal: number; catatan: string; dibuatOleh: Pelaku; dibuatPada: Date }
export interface Pengaturan { namaWarung: string; qrisStatis: string | null; namaMerchant: string | null }
export interface SesiAktif { sesiKasId: string | null; ditinggalTerakhir: number }
```

- Produces (`src/lib/kas.ts`):
  - `hitungTotal(item: ItemPesanan[]): number`
  - `ringkasSesi(sesi: SesiKas, pesanan: Pesanan[], pengeluaran: Pengeluaran[]): { penjualanTunai: number; penjualanQris: number; pengeluaranLaci: number; tunaiSeharusnya: number; jumlahBelumBayar: number }`
  - `validasiTutup(input: { ringkasan: ReturnType<typeof ringkasSesi>; tunaiDihitung: number; qrisMerchant: number; disetor: number; ditinggal: number; catatan: string }): string[]` (list of Indonesian error messages; empty = ok)

- [ ] **Step 1: Write failing tests**

```ts
expect(hitungTotal([{ menuId:'a', nama:'Pecel Lele', harga:15000, jumlah:2 }, { menuId:'b', nama:'Es Teh', harga:4000, jumlah:3 }])).toBe(42000);
// ringkasSesi: modalAwal 100000; lunas tunai 42000; lunas qris 23000; batal tunai 15000 (ignored);
// belum_bayar 10000; pengeluaran dariLaci 30000 aktif, dariLaci 5000 batal (ignored), non-laci 50000 (ignored for cash)
expect(r).toEqual({ penjualanTunai:42000, penjualanQris:23000, pengeluaranLaci:30000, tunaiSeharusnya:112000, jumlahBelumBayar:1 });
// validasiTutup
expect(validasiTutup({ ringkasan: r, tunaiDihitung:112000, qrisMerchant:23000, disetor:62000, ditinggal:50000, catatan:'' }))
  .toEqual(['Masih ada 1 pesanan belum bayar. Lunasi atau batalkan dulu.']);
// with jumlahBelumBayar 0:
expect(validasiTutup({... tunaiDihitung:110000, catatan:'' ...})).toContain('Uang tunai selisih -Rp 2.000. Tulis catatan.');
expect(validasiTutup({... qrisMerchant:20000, catatan:'' ...})).toContain('QRIS selisih -Rp 3.000. Tulis catatan.');
expect(validasiTutup({... tunaiDihitung:110000, catatan:'uang kembalian salah' , disetor:60000, ditinggal:50000 })).toEqual([]);
expect(validasiTutup({... disetor:60000, ditinggal:40000 ...})).toContain('Setor + ditinggal harus sama dengan uang yang dihitung (Rp 112.000).');
```

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** `tunaiSeharusnya = modalAwal + penjualanTunai − pengeluaranLaci`. Only `lunas` orders count toward sales. Only `aktif` expenses with `dariLaci` count. Selisih = counted − expected.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(warung): domain types and cash session calculations`

---

### Task 4: Reports, alerts, CSV

**Files:**
- Create: `src/lib/rekap.ts`
- Test: `tests/lib/rekap.test.ts`

**Interfaces:**
- Consumes: types from Task 3.
- Produces:
  - `rekapPeriode(d: { pesanan: Pesanan[]; pengeluaran: Pengeluaran[]; koreksi: Koreksi[] }, dari: string, sampai: string): Rekap`, where `Rekap = { penjualanTunai; penjualanQris; penjualanTotal; jumlahPesanan; pengeluaranPerKategori: Record<KategoriPengeluaran, number>; pengeluaranTotal; koreksiTotal; perkiraanLaba; perHari: { tanggal: string; penjualan: number; pengeluaran: number }[]; menuTerlaris: { nama: string; porsi: number; rupiah: number }[] }` (all numbers)
  - `daftarPeringatan(d: { sesi: SesiKas[]; pesanan: Pesanan[]; pengeluaran: Pengeluaran[] }): Peringatan[]`, where `Peringatan = { jenis: 'batal_pesanan' | 'batal_pengeluaran' | 'selisih_tunai' | 'selisih_qris' | 'modal_diubah'; waktu: Date; pesan: string; refId: string }`, newest first
  - `keCSV(r: Rekap, dari: string, sampai: string): string`

- [ ] **Step 1: Write failing tests**
  - Profit is `penjualanTotal − pengeluaranTotal + koreksiTotal`. Cancelled orders and expenses are excluded.
  - Owner expenses with `sesiKasId: null` are included by their `tanggal`.
  - The `dari`/`sampai` bounds are inclusive by `tanggal`.
  - `perHari` has every date in the range, including zero days, in ascending order.
  - `menuTerlaris` is sorted by `porsi` descending (ties by `rupiah`), grouped by `nama` from the snapshot.
  - `daftarPeringatan`: a cancelled lunas order produces `{ jenis:'batal_pesanan', pesan: 'Pesanan #3 (Rp 42.000) dibatalkan oleh Budi: salah input' }`.
  - A closed session with `selisihTunai: -2000` produces `jenis:'selisih_tunai'`.
  - A session with `alasanUbahModal` produces `modal_diubah`.
  - Sessions with zero selisih produce nothing.
  - `keCSV` first line is `Tanggal,Penjualan,Pengeluaran`. Then one line per `perHari` with plain integers. Then a blank line and a summary block with `Penjualan tunai`, `Penjualan QRIS`, `Pengeluaran`, `Koreksi` and `Perkiraan laba`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** in `src/lib/rekap.ts`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(warung): period report, owner alerts and CSV export`

---

### Task 5: Receipt text and ESC/POS bytes

**Files:**
- Create: `src/lib/struk.ts`
- Test: `tests/lib/struk.test.ts`

**Interfaces:**
- Produces:
  - `barisStruk(p: Pesanan, namaWarung: string, salinan: boolean): string[]` (each line ≤ 32 chars, 58 mm)
  - `keEscPos(baris: string[]): Uint8Array`
  - `bolehCetak(p: Pesanan): boolean` (true only when `status === 'lunas'`)

- [ ] **Step 1: Write failing tests.** For a lunas tunai order `#7`, label `Meja 2`, kasir `Budi`, item `2 × Pecel Lele 15000` and `1 × Es Teh 4000`, total 34000, `uangDiterima` 50000:
  - Every line is `.length <= 32`.
  - Lines include, in order: the warung name, centered; `20/11/2026 19:05`; `No. 7  Meja 2`; `Pecel Lele` followed by `2 x 15.000` right-aligned to `30.000`; `TOTAL` with `34.000` right-aligned; `Tunai 50.000`; `Kembali 16.000`; `Kasir: Budi`; `Terima kasih`.
  - With `salinan=true`, the second line is `*** SALINAN ***`.
  - A QRIS order shows `QRIS` and no `Kembali`.
  - Item names longer than 32 chars wrap and are not cut.
  - `bolehCetak` is false for `belum_bayar` and `batal`.
  - `keEscPos` starts with `0x1B 0x40` (init), ends with a feed-and-cut (`0x1D 0x56 0x42 0x00`), and contains the ASCII of `TOTAL`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Date and time come from `dilunasiPada` in WIB (Task 1 helpers). Non-ASCII characters are replaced with `?` in `keEscPos`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(warung): receipt layout and ESC/POS encoding`

---

### Task 6: Firestore security rules

**Files:**
- Create: `firestore.rules`, `firebase.json` (emulators: auth 9099, firestore 8080; rules path), `.firebaserc` (project `demo-warung`)
- Test: `tests/rules/rules.test.ts`

**Interfaces:**
- Produces the data contract later tasks must follow:
  - `pengaturan/sesiAktif` is `SesiAktif`.
  - Opening a session is one batch: create `sesiKas/{id}` (status `buka`, `jumlahPesanan` 0) **and** update `sesiAktif.sesiKasId` from `null` to `{id}`.
  - Creating an order is one batch: create `pesanan/{id}` with `nomor = sesi.jumlahPesanan + 1` **and** update the session's `jumlahPesanan` by +1.
  - Closing is one batch: the session goes to `tutup` with all close fields, **and** `sesiAktif` becomes `{ sesiKasId: null, ditinggalTerakhir: ditinggal }`.

- [ ] **Step 1: Write failing rules tests** with `@firebase/rules-unit-testing`. Seed with `withSecurityRulesDisabled`: `users/owner` (pemilik), `users/budi` (karyawan aktif), `users/eks` (karyawan, `aktif:false`), and `sesiAktif {sesiKasId:null, ditinggalTerakhir:50000}`. Cases:
  - `karyawan can open session when none is open`
  - `rules: second open session is denied` (sesiAktif already non-null)
  - `karyawan can create pesanan in open session with nomor = jumlahPesanan+1 and dibuatOleh.uid = self`
  - `pesanan in closed session is denied`
  - `pesanan with dibuatOleh.uid of someone else is denied`
  - `pesanan with total <= 0 or non-int is denied`
  - `belum_bayar → lunas with caraBayar is allowed`
  - `rules: lunas → lunas is denied`
  - `lunas → batal with alasanBatal (non-empty) is allowed`
  - `batal without alasanBatal is denied`
  - `changing item/total/harga on update is denied`
  - `jumlahCetak +1 on lunas allowed; +2 or decrease denied`
  - `delete pesanan/pengeluaran/sesiKas/koreksi denied for owner too`
  - `closed sesiKas cannot be updated`
  - `karyawan cannot write menu/users/pengaturan/warung/koreksi`
  - `karyawan cannot create pengeluaran with sesiKasId null`
  - `owner can create pengeluaran with sesiKasId null`
  - `inactive user cannot read anything`
  - `unauthenticated cannot read anything`
- [ ] **Step 2: Run** `npm run test:emu`. Expected: FAIL. (The first run downloads the emulator jar. If the download is blocked by the network, stop and report it; do not skip these tests.)
- [ ] **Step 3: Implement `firestore.rules`.**
  - Helpers: `pengguna()`, `aktif()`, `pemilik()`, `pelakuSaya(p)`.
  - Use `getAfter()` for the batched invariants above.
  - Use `diff().affectedKeys().hasOnly([...])` for allowed transitions.
  - Total validation in rules: `total is int && total > 0 && item.size() > 0 && item.size() <= 50`. The full sum is checked in the app via `hitungTotal`.
- [ ] **Step 4: Run** `npm run test:emu`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat(warung): firestore rules enforcing append-only records`

---

### Task 7: Firebase init and data layer

**Files:**
- Create: `src/firebase.ts`, `src/data/sesi.ts`, `src/data/pesanan.ts`, `src/data/pengeluaran.ts`, `src/data/menu.ts`, `src/data/pengaturan.ts`, `src/data/koreksi.ts`, `src/data/konversi.ts` (Firestore Timestamp ↔ Date)
- Test: `tests/data/alur.test.ts` (emulator)

**Interfaces:**
- Consumes: types (Task 3), `hitungTotal`/`ringkasSesi`/`validasiTutup` (Task 3), `tanggalWIB` (Task 1), the rules contract (Task 6).
- Produces (every function takes `db: Firestore` first, so tests can pass the emulator instance):
  - `firebase.ts`: `app`, `auth`, `db`. Config comes from `import.meta.env.VITE_FIREBASE_*`. If `VITE_EMULATOR === '1'`, connect to the emulators.
  - `bukaSesi(db, pelaku: Pelaku, modalAwal: number, alasanUbahModal: string | null): Promise<SesiKas>` (transaction; if a session is already open, returns that session instead of throwing)
  - `ambilSesiAktif(db): Promise<{ aktif: SesiKas | null; modalSaran: number }>`
  - `pantauSesiAktif(db, cb: (s: SesiKas | null) => void): Unsubscribe`
  - `tutupSesi(db, pelaku, sesiId, data: { tunaiDihitung; qrisMerchant; disetor; ditinggal; catatan }): Promise<void>` (recomputes `ringkasSesi` inside the transaction and throws `Error(validasiTutup(...).join('\n'))` if not empty)
  - `buatPesanan(db, pelaku, sesiId, keranjang: { menu: Menu; jumlah: number }[], opsi: { label: string; catatan: string; bayar: { caraBayar: CaraBayar; uangDiterima: number | null } | null }): Promise<Pesanan>` (copies `nama`/`harga` from `menu`; `tanggal` = session tanggal; status `lunas` if `bayar` is given, else `belum_bayar`)
  - `lunasiPesanan(db, pelaku, id, caraBayar: CaraBayar, uangDiterima: number | null): Promise<void>`
  - `batalkanPesanan(db, pelaku, id, alasan: string): Promise<void>`
  - `catatCetak(db, id): Promise<void>` (increment `jumlahCetak`)
  - `pantauPesananSesi(db, sesiId, cb): Unsubscribe`
  - `catatPengeluaran(db, pelaku, data: { sesiKasId: string | null; kategori; keterangan; nominal; dariLaci }): Promise<void>` (`tanggal` = session tanggal, or `tanggalWIB(now)` when null)
  - `batalkanPengeluaran(db, pelaku, id, alasan)`
  - `ambilPeriode(db, dari: string, sampai: string): Promise<{ sesi: SesiKas[]; pesanan: Pesanan[]; pengeluaran: Pengeluaran[]; koreksi: Koreksi[] }>`
  - `pantauMenu(db, cb)`, `simpanMenu(db, m: Omit<Menu,'id'> & { id?: string })`
  - `ambilPengaturan(db)`, `simpanPengaturan(db, p: Pengaturan)`
  - `tambahKoreksi(db, pelaku, sesiId, nominal, catatan)`

- [ ] **Step 1: Write failing emulator tests** in `tests/data/alur.test.ts`, signing in as seeded users:
  - Full shift: bukaSesi(100000) → buatPesanan tunai lunas 42000 → buatPesanan qris lunas 23000 → buatPesanan belum_bayar 10000 → `tutupSesi` throws `belum bayar` → lunasi it as qris → tutupSesi(tunaiDihitung 142000, qrisMerchant 33000, disetor 92000, ditinggal 50000) succeeds. The closed session has `selisihTunai 0`, `selisihQris 0`, and `ambilSesiAktif` returns `{ aktif:null, modalSaran:50000 }`.
  - `bukaSesi twice returns existing session` (same id).
  - `nomor increments 1,2,3 within a session`.
  - `buatPesanan copies nama and harga`: change the menu price after creating the order; the order still holds the old price.
  - `pesanan uses sesi tanggal, not clock date`: create a session doc seeded with `tanggal:'2026-11-20'` and create an order (the test does not depend on the real clock).
  - `owner pengeluaran without session gets today's WIB tanggal`.
- [ ] **Step 2: Run** `npm run test:emu`. Expected: FAIL.
- [ ] **Step 3: Implement** the data modules. Use `runTransaction` for open, close and order creation. Use `serverTimestamp()` for all `*Pada` fields.
- [ ] **Step 4: Run** `npm run test:emu`. Expected: PASS (including the Task 6 tests).
- [ ] **Step 5: Commit** `feat(warung): firestore data layer`

---

### Task 8: Login and employee accounts

**Files:**
- Create: `src/data/auth.ts`, `api/karyawanHandler.ts`, `api/karyawan.ts`, `src/data/karyawan.ts`, `scripts/buat-pemilik.ts`
- Test: `tests/api/karyawanHandler.test.ts`, `tests/lib/username.test.ts`

**Interfaces:**
- Produces:
  - `src/data/auth.ts`:
    - `emailDariUsername(u: string): string`
    - `usernameValid(u: string): boolean` (`/^[a-z0-9_]{3,20}$/`)
    - `masuk(auth, username, password): Promise<void>` (Indonesian error for wrong credentials: `Username atau kata sandi salah.`)
    - `keluar(auth)`
    - `pantauPengguna(auth, db, cb: (p: Pengguna | null) => void)` (signs out and returns null if `aktif` is false)
  - `api/karyawanHandler.ts`: `prosesKaryawan(body: unknown, idToken: string | null, deps: { verifikasiToken(t: string): Promise<{ uid: string }>; ambilPengguna(uid: string): Promise<Pengguna | null>; buatAkun(email: string, password: string): Promise<string>; setPassword(uid: string, pw: string): Promise<void>; nonaktifkan(uid: string): Promise<void>; simpanPengguna(p: Pengguna): Promise<void> }): Promise<{ status: number; body: { ok: boolean; pesan?: string; uid?: string } }>`
  - Body shapes: `{ aksi: 'buat', nama, username, password }`, `{ aksi: 'reset', uid, password }`, `{ aksi: 'nonaktifkan', uid }`.
  - `api/karyawan.ts`: a Vercel handler wiring `firebase-admin` (service account from env `FIREBASE_SERVICE_ACCOUNT` JSON) into `prosesKaryawan`. Deactivation also calls `admin.auth().updateUser(uid, { disabled: true })`.
  - `src/data/karyawan.ts`: `buatKaryawan(nama, username, password)`, `resetSandi(uid, password)` and `nonaktifkanKaryawan(uid)`. Each POSTs to `/api/karyawan` with `Authorization: Bearer <idToken>`.
  - `scripts/buat-pemilik.ts`: CLI `npx tsx scripts/buat-pemilik.ts <username> <password> <nama>` using the service account env. Creates the first owner.

- [ ] **Step 1: Write failing tests** for `usernameValid`/`emailDariUsername` (`'budi'`→`'budi@warung.app'`; `'Budi'`, `'b'`, `'budi lele'` invalid) and `prosesKaryawan`:
  - No token → 401.
  - Caller is karyawan → 403.
  - Owner + `buat` with an invalid username → 400 `Username hanya huruf kecil, angka, _ (3–20 karakter).`
  - Password shorter than 6 → 400.
  - Valid `buat` → 200 with uid; `simpanPengguna` is called with `{peran:'karyawan', aktif:true}`.
  - `reset` → `setPassword` is called.
  - `nonaktifkan` → `nonaktifkan` is called and `simpanPengguna` gets `aktif:false`.
  - Owner trying to `nonaktifkan` self → 400.
- [ ] **Step 2: Run** `npx vitest run tests/api tests/lib/username.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the files above.
- [ ] **Step 4: Run.** Expected: PASS. Also run `npm run lint`.
- [ ] **Step 5: Commit** `feat(warung): username login and owner-managed employee accounts`

---

### Task 9: App shell, login screen, cashier screen

**Files:**
- Create: `src/ui/App.tsx` (replaces placeholder), `src/ui/Masuk.tsx`, `src/ui/Kerangka.tsx` (header + bottom nav), `src/ui/BukaKas.tsx`, `src/ui/Kasir.tsx`, `src/ui/Bayar.tsx`, `src/ui/QrisLayar.tsx`, `src/ui/komponen/*` (Tombol, InputRupiah, Dialog)
- Test: `tests/ui/Kasir.test.tsx` (Vitest + @testing-library/react + jsdom; add those dev deps)

**Interfaces:**
- Consumes: data layer (Task 7), auth (Task 8), `qrisDinamis` (Task 2), `formatRupiah`/`parseRupiah` (Task 1), `hitungTotal` (Task 3).
- Produces: `InputRupiah` (`{ label: string; value: number | null; onChange(n: number | null): void }`) and `Dialog` (`{ judul; children; onTutup }`), used by later UI tasks.

Behavior (copy is exact):
- Login: fields **Username** and **Kata sandi**, button **Masuk**.
- Bottom nav for karyawan: **Kasir · Pesanan · Pengeluaran · Tutup Kas**. The owner additionally has **Beranda** (first, default) and **Lainnya** (owner menu).
- No open session → `BukaKas`. It shows "Modal awal di laci" prefilled with `modalSaran`. If the value differs, the **Alasan** field becomes required. Button **Buka Kas**.
- Kasir:
  - Menu grid grouped by category. Only `aktif` items are shown.
  - Tap = +1. The cart bar at the bottom shows the item count and total.
  - The cart sheet has −/+ per line, optional **Label** and **Catatan**, and buttons **Bayar Sekarang** and **Simpan, Bayar Nanti**.
- Bayar:
  - Two big buttons, **Tunai** and **QRIS**.
  - Tunai: optional **Uang diterima**, showing **Kembalian**. Button **Simpan Lunas**.
  - QRIS: `QrisLayar` shows a full-screen QR (`qrcode.toDataURL(qrisDinamis(statis, total))`) and the total in large type. Buttons **Sudah masuk, tandai lunas** and **Ganti ke tunai**. If no QRIS is set up: "QRIS warung belum diatur. Minta pemilik mengisi di Pengaturan."
- Every save button is disabled and shows "Menyimpan…" while its promise is pending.

- [ ] **Step 1: Write failing UI tests** with the data layer mocked:
  - Tapping "Pecel Lele" twice and "Es Teh" once shows `Rp 34.000` in the cart bar.
  - "Simpan Lunas" calls `buatPesanan` once even when clicked twice quickly.
  - Kembalian for uang diterima `50.000` on 34000 shows `Rp 16.000`.
  - QRIS with no `qrisStatis` shows the "belum diatur" message.
- [ ] **Step 2: Run** `npx vitest run tests/ui`. Expected: FAIL.
- [ ] **Step 3: Implement** the screens.
- [ ] **Step 4: Run** the tests. Expected: PASS. Then `npm run lint && npm run build`.
- [ ] **Step 5: Commit** `feat(warung): login, open session and cashier flow with dynamic QRIS`

---

### Task 10: Orders list, expenses, close session

**Files:**
- Create: `src/ui/DaftarPesanan.tsx`, `src/ui/Pengeluaran.tsx`, `src/ui/TutupKas.tsx`, `src/ui/Batalkan.tsx` (shared cancel dialog)
- Test: `tests/ui/TutupKas.test.tsx`

**Interfaces:**
- Consumes: Task 7 data functions, Task 3 `ringkasSesi`/`validasiTutup`, Task 9 components, Task 14 `cetakPesanan` (until Task 14 lands, the print button calls a stub exported from `src/printer/printer.ts` that resolves).

Behavior:
- DaftarPesanan:
  - Tabs **Belum bayar · Lunas · Batal** for the current session.
  - Each row shows `#nomor`, label, total, cara bayar and pencatat.
  - Belum bayar row → **Bayar** (reuses `Bayar`).
  - Lunas row → **Cetak struk** (and **Cetak ulang** when `jumlahCetak > 0`) and **Batalkan**.
- Batalkan dialog: **Alasan pembatalan** is required. Button **Batalkan Pesanan**.
- Pengeluaran: form with **Kategori**, **Nominal**, **Keterangan**, and a toggle **Uang dari laci?** (default yes). Below it, today's list with **Batalkan**.
- TutupKas:
  - Shows modal awal, penjualan tunai, pengeluaran dari laci, and **Uang tunai seharusnya**.
  - Inputs **Uang tunai dihitung**, then **Total QRIS di aplikasi merchant** (with a hint showing the app total), then **Disetor ke pemilik** and **Ditinggal di laci** (prefilled `ditinggal = modalSaran or 0`, `disetor = dihitung − ditinggal`). Selisih is shown live, red when ≠ 0. **Catatan** is required when any selisih ≠ 0.
  - Button **Tutup Kas** is disabled until `validasiTutup` returns `[]`. The messages are shown above the button.

- [ ] **Step 1: Write failing UI test:** with a mocked summary where seharusnya is 112000, typing dihitung `110.000` shows `Selisih -Rp 2.000` and the button stays disabled. After entering a catatan and matching setor/tinggal, the button is enabled and calls `tutupSesi` with the parsed integers.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the screens.
- [ ] **Step 4: Run** `npx vitest run tests/ui && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(warung): order list, expenses and close-session screens`

---

### Task 11: Owner dashboard, reports, history, cancellations

**Files:**
- Create: `src/ui/pemilik/Beranda.tsx`, `src/ui/pemilik/Rekap.tsx`, `src/ui/pemilik/RiwayatKas.tsx`, `src/ui/pemilik/Pembatalan.tsx`, `src/ui/pemilik/Lainnya.tsx` (menu linking to Rekap, Riwayat Kas, Pembatalan, Pengeluaran Pemilik, Kelola Menu, Karyawan, Pengaturan)
- Test: `tests/ui/Beranda.test.tsx`

**Interfaces:**
- Consumes: `ambilPeriode` (Task 7), `rekapPeriode`/`daftarPeringatan`/`keCSV` (Task 4), `tambahKoreksi` and `catatPengeluaran(sesiKasId:null)` (Task 7).

Behavior:
- Beranda:
  - Shows "Hari ini": penjualan total (tunai / QRIS), jumlah pesanan, pengeluaran and perkiraan laba.
  - Kas status: **Buka sejak 17:02 oleh Budi** or **Tutup**. Also shows the count of belum bayar.
  - **Peringatan** list from `daftarPeringatan` over the last 7 days, newest first, each item tappable to its detail.
  - "Hari ini" uses the `tanggal` of the open session if one exists, else `tanggalWIB(now)`.
- Rekap:
  - Presets **Hari ini · 7 hari · Bulan ini** plus a custom date range.
  - Summary cards, an expense breakdown and the top-10 menu.
  - A daily bar chart drawn as plain SVG/CSS bars (no chart library needed).
  - **Unduh CSV** downloads `rekap-<dari>-<sampai>.csv` via a Blob link.
- RiwayatKas: list of sessions, newest first. Selisih is colored. Expanding a session shows all close fields, its koreksi, and the button **Tambah catatan koreksi** (nominal may be 0 or negative, catatan required).
- Pembatalan: cancelled orders and expenses for a selected range, with alasan, waktu and pelaku.
- Pengeluaran Pemilik: same form as Task 10 without the laci toggle (`dariLaci:false`, `sesiKasId:null`).

- [ ] **Step 1: Write failing UI test:** with a mocked `ambilPeriode` containing one cancelled lunas order, Beranda shows `Pesanan #3 (Rp 42.000) dibatalkan oleh Budi: salah input` under Peringatan, and the numbers match `rekapPeriode`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the screens.
- [ ] **Step 4: Run** `npx vitest run tests/ui && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(warung): owner dashboard, reports, cash history and cancellations`

---

### Task 12: Owner settings — menu, employees, QRIS

**Files:**
- Create: `src/ui/pemilik/KelolaMenu.tsx`, `src/ui/pemilik/Karyawan.tsx`, `src/ui/pemilik/PengaturanWarung.tsx`, `src/lib/bacaQrGambar.ts`
- Test: `tests/lib/bacaQrGambar.test.ts`

**Interfaces:**
- Consumes: `simpanMenu`/`pantauMenu`, `ambilPengaturan`/`simpanPengaturan` (Task 7), `buatKaryawan`/`resetSandi`/`nonaktifkanKaryawan` (Task 8), `validasiQris` (Task 2).
- Produces: `bacaQrDariPiksel(data: Uint8ClampedArray, lebar: number, tinggi: number): string | null` (wraps `jsqr`), plus a browser-only `bacaQrDariFile(f: File): Promise<string | null>` (canvas → pixels → `bacaQrDariPiksel`).

Behavior:
- KelolaMenu:
  - List by category with price.
  - Add/edit form: **Nama**, **Harga**, **Kategori**, **Aktif** toggle, and up/down order.
  - There is no delete button.
  - First run with an empty menu offers **Isi contoh menu**, which creates: Pecel Lele 15000, Ayam Penyet 18000, Nasi Putih 5000, Tahu/Tempe 2000, Es Teh 4000, Teh Hangat 3000, Es Jeruk 6000. These are placeholders the owner edits.
- Karyawan:
  - List with status.
  - **Tambah Karyawan** (Nama, Username, Kata sandi).
  - **Reset sandi** and **Nonaktifkan** per row. Nonaktifkan asks for confirmation by name.
- PengaturanWarung:
  - **Nama warung**.
  - QRIS section: **Foto / pilih gambar QRIS** (`<input type="file" accept="image/*" capture="environment">`) or **Tempel kode QRIS**. Show `validasiQris` → "QRIS valid: <namaMerchant>" or the error. Save only when valid.
  - A preview of the dynamic QR for Rp 1.000 as a test the owner can scan without paying.

- [ ] **Step 1: Write failing test:** generate a QR PNG of the Task 2 fixture with `qrcode.toBuffer`, decode it to pixels (use `pngjs`, a dev dependency), and check that `bacaQrDariPiksel` returns the fixture string.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the module and screens.
- [ ] **Step 4: Run** `npx vitest run && npm run lint && npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(warung): owner settings for menu, employees and QRIS`

---

### Task 13: End-to-end smoke test against emulators

**Files:**
- Create: `tests/e2e/shift.spec.ts`, `scripts/seed-emulator.ts`, plus `e2e` script in package.json: `firebase emulators:exec --only auth,firestore "tsx scripts/seed-emulator.ts && playwright test tests/e2e"` (Vite dev server with `VITE_EMULATOR=1` started via Playwright `webServer`)

**Interfaces:**
- Consumes: the whole app. The seed creates owner `pemilik`/`rahasia1`, karyawan `budi`/`rahasia1`, the sample menu, and the Task 2 QRIS fixture.

- [ ] **Step 1: Write the Playwright test** at a phone viewport (Pixel 5 device):
  - Budi logs in and opens kas with 100.000.
  - Adds 2 × Pecel Lele + 1 × Es Teh, pays tunai 50.000, and sees Kembalian Rp 16.000.
  - Adds an Ayam Penyet as QRIS and sees a QR image and `Rp 18.000`, then taps "Sudah masuk".
  - Closes kas with dihitung 134.000, QRIS 18.000, disetor 84.000, ditinggal 50.000.
  - Logs out. The owner logs in and Beranda shows penjualan `Rp 52.000`, with tunai `Rp 34.000` and QRIS `Rp 18.000`.

  Run with `--trace off`.
- [ ] **Step 2: Run** `npm run e2e`. Fix app bugs it finds (not the test) until it passes.
- [ ] **Step 3: Commit** `test(warung): end-to-end shift smoke test`

---

### Task 14: Printing, Android wrapper, deploy config, setup guide

**Files:**
- Create: `src/printer/printer.ts`, `src/ui/PengaturanPrinter.tsx` (in the nav for all users under the gear icon), `capacitor.config.ts`, `vercel.json`, `README.md`; the `android/` folder is generated by `npx cap add android`
- Test: `tests/lib/printer.test.ts`

**Interfaces:**
- Consumes: `barisStruk`/`keEscPos`/`bolehCetak` (Task 5), `catatCetak` (Task 7).
- Produces:
  - `printerTersedia(): boolean` (`Capacitor.isNativePlatform()`)
  - `cariPrinter(): Promise<{ nama: string; alamat: string }[]>` (paired devices)
  - `simpanPrinter(alamat: string): void` (localStorage `warung.printer`, wrapped in try/catch)
  - `cetakPesanan(p: Pesanan, namaWarung: string): Promise<void>`. It refuses if `!bolehCetak(p)`. `salinan = p.jumlahCetak > 0`. On native it sends `keEscPos(barisStruk(...))` to the saved printer. In a browser it opens a print window with the lines in a 58 mm monospace layout. On success it calls `catatCetak`.
  - Setting `warung.cetakOtomatis` (bool): when true, `Bayar` calls `cetakPesanan` right after a successful lunas.

- [ ] **Step 1: Write failing test** with mocked Capacitor and plugin:
  - `cetakPesanan` on a `belum_bayar` order rejects with `Struk hanya untuk pesanan lunas.`
  - On a lunas order with `jumlahCetak: 1`, the bytes sent contain `SALINAN` and `catatCetak` is called once.
  - When the plugin write throws, `catatCetak` is **not** called and the error message is `Printer tidak tersambung. Cek Bluetooth dan printer.`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement printer.ts.**
  - Choose a Capacitor-compatible **Bluetooth Classic (SPP)** plugin. Most cheap 58 mm printers are not BLE.
  - Record the chosen package and why in a comment at the top of `printer.ts`.
  - Request `BLUETOOTH_CONNECT`/`BLUETOOTH_SCAN` at runtime on Android 12+.
- [ ] **Step 4: Run** `npx vitest run && npm run lint && npm run build`. Expected: PASS.
- [ ] **Step 5: Android + deploy config.**
  - `capacitor.config.ts`: `appId: 'id.warung.pecellele'`, `appName: 'Warung'`, `webDir: 'dist'`, `server: { url: process.env.WARUNG_URL, cleartext: false }`.
  - `vercel.json`: rewrite every non-`/api/` path to `/index.html`.
  - Run `npx cap add android && npx cap sync`. Expected: an `android/` folder exists, with the plugin listed in `android/capacitor.settings.gradle`.
  - Building the APK needs the Android SDK. If it is unavailable here, say so in the handoff instead of claiming the APK was built.
- [ ] **Step 6: Write README.md** in plain Indonesian for the owner, step by step:
  1. Create the Firebase project (Auth email/password, Firestore `asia-southeast2`) and copy the config.
  2. `firebase deploy --only firestore:rules`.
  3. Create a service account key.
  4. Create the Vercel project with root `warung/`, env `VITE_FIREBASE_*` + `FIREBASE_SERVICE_ACCOUNT`.
  5. `npx tsx scripts/buat-pemilik.ts`.
  6. Log in, fill in the menu, QRIS and employees.
  7. Build the APK (`WARUNG_URL=<vercel url> npx cap sync`, then Android Studio → Build APK) and send it to employees.
  8. Pair the printer in Android Bluetooth settings, then choose it in the app's Printer settings.
- [ ] **Step 7: Commit** `feat(warung): bluetooth receipt printing, android wrapper, deploy guide`

---

## Spec coverage check

| Spec item | Task |
|---|---|
| Tap-menu orders, auto total | 3, 9 |
| Tunai / QRIS, dynamic QRIS, manual confirm | 2, 9 |
| Belum bayar, must settle before close | 3, 7, 10 |
| Expenses (laci / bukan laci), owner expenses outside session | 7, 10, 11 |
| Session per shift, past-midnight tanggal, single open session | 6, 7 |
| Close: cash count, QRIS reconcile, setor/tinggal, carry-over modal, flagged change | 3, 7, 9, 10 |
| No edit, cancel with reason, owner alerts | 4, 6, 10, 11 |
| Receipts, SALINAN, print count, auto-print option | 5, 14 |
| Owner dashboard, reports, top menu, CSV, cash history, koreksi | 4, 11 |
| Menu / employees / QRIS management | 8, 12 |
| Security rules, no delete, inactive users locked out | 6 |
| Username login, no Google | 8, 9 |
| Vercel + Capacitor server.url, setup guide | 14 |
