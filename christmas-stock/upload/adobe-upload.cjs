#!/usr/bin/env node
/**
 * Upload semi-otomatis ke Adobe Stock Contributor.
 * - Browser terbuka (bukan headless); user LOGIN MANUAL. Password tidak pernah disimpan script.
 * - Sesi login disimpan di profil lokal (~/.adobe-stock-profile) agar lain kali tidak perlu login ulang.
 * - Script upload semua gambar lalu CSV metadata, lalu BERHENTI sebelum Submit (user review & submit sendiri).
 *
 * Pakai:
 *   node christmas-stock/upload/adobe-upload.cjs [folder] [--check] [--profile DIR] [--url URL]
 *   folder default: christmas-stock/vector/upload (harus berisi gambar + satu file .csv)
 *   --check  : hanya validasi file & CSV, tanpa membuka browser
 */
const fs = require('fs'), path = require('path'), os = require('os'), readline = require('readline');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const positional = args.filter((a, i) => !a.startsWith('--') && !['--profile', '--url'].includes(args[i - 1]));
const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.resolve(positional[0] || path.join(ROOT, 'christmas-stock/vector/upload'));
const PROFILE = opt('--profile', path.join(os.homedir(), '.adobe-stock-profile'));
const URL = opt('--url', 'https://contributor.stock.adobe.com/en/uploads');
const EXT = ['.eps', '.ai', '.jpg', '.jpeg', '.png', '.svg', '.mp4', '.mov'];

// satu readline untuk seluruh sesi (aman juga bila stdin di-pipe)
let rl, lines = [], waiters = [];
function ask(q) {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (l) => (waiters.length ? waiters.shift()(l) : lines.push(l)));
    rl.on('close', () => { while (waiters.length) waiters.shift()(''); });
  }
  process.stdout.write(q);
  return new Promise((r) => (lines.length ? r(lines.shift().trim()) : waiters.push((l) => r(l.trim()))));
}

function parseCsvFilenames(text) {
  // kolom pertama = Filename; nilai bisa ber-quote
  return text.split(/\r?\n/).slice(1).filter(Boolean).map((l) => {
    const m = l.match(/^"((?:[^"]|"")*)"|^([^,]*)/); return (m[1] ?? m[2]).replace(/""/g, '"');
  });
}

function check() {
  if (!fs.existsSync(DIR)) throw new Error(`Folder tidak ada: ${DIR}`);
  const all = fs.readdirSync(DIR).sort();
  const files = all.filter((f) => EXT.includes(path.extname(f).toLowerCase()));
  const csvs = all.filter((f) => f.toLowerCase().endsWith('.csv'));
  const problems = [];
  if (!files.length) problems.push('Tidak ada file gambar.');
  if (csvs.length !== 1) problems.push(`Harus ada tepat 1 CSV, ditemukan ${csvs.length}.`);
  let names = [];
  if (csvs.length === 1) {
    names = parseCsvFilenames(fs.readFileSync(path.join(DIR, csvs[0]), 'utf8'));
    const missing = names.filter((n) => !files.includes(n));
    const unlisted = files.filter((f) => !names.includes(f));
    if (missing.length) problems.push(`Ada di CSV tapi file tidak ada: ${missing.join(', ')}`);
    if (unlisted.length) problems.push(`File tanpa metadata di CSV: ${unlisted.join(', ')}`);
  }
  for (const f of files) {
    const mb = fs.statSync(path.join(DIR, f)).size / 1e6;
    if (mb > 45) problems.push(`${f} ${mb.toFixed(1)} MB > batas 45 MB`);
  }
  console.log(`Folder : ${DIR}\nFile   : ${files.length}\nCSV    : ${csvs[0] || '-'} (${names.length} baris)`);
  if (problems.length) { console.log('\nMASALAH:\n- ' + problems.join('\n- ')); process.exitCode = 1; }
  else console.log('\nOK: semua file punya metadata dan ukuran aman.');
  return { files: files.map((f) => path.join(DIR, f)), csv: csvs[0] && path.join(DIR, csvs[0]), ok: !problems.length };
}

async function pickFiles(page, trigger, filePaths, label) {
  // 1) coba file chooser dari tombol; 2) fallback input[type=file]; 3) fallback manual
  try {
    const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }), trigger()]);
    await fc.setFiles(filePaths); return true;
  } catch (_) {}
  const inputs = page.locator('input[type=file]');
  if (await inputs.count()) {
    try { await inputs.last().setInputFiles(filePaths); return true; } catch (_) {}
  }
  console.log(`\n[!] Tidak menemukan tombol/input untuk ${label}. Lakukan manual: pilih file dari\n    ${path.dirname(filePaths[0])}`);
  await ask('    Tekan Enter setelah selesai... ');
  return false;
}

async function main() {
  const { files, csv, ok } = check();
  if (flag('--check')) return;
  if (!ok) { const a = await ask('\nAda masalah. Tetap lanjut? (y/N) '); if (a.toLowerCase() !== 'y') return; }

  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { console.error('\nPlaywright belum terpasang. Jalankan:\n  npm i -D playwright && npx playwright install chromium'); process.exit(1); }

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: !!process.env.ADOBE_UPLOAD_HEADLESS, viewport: null, acceptDownloads: false,
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  if (process.env.ADOBE_UPLOAD_DEBUG) page.on('console', (m) => console.log('[page]', m.text()));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  // --- 1. Login manual ---
  const loggedIn = async () => /contributor\.stock\.adobe\.com/.test(page.url())
    && await page.getByRole('button', { name: /^upload$/i }).or(page.getByText(/upload csv/i)).first().isVisible().catch(() => false);
  if (!(await loggedIn())) {
    console.log('\n>>> Silakan LOGIN di jendela browser yang terbuka (email, password, 2FA).');
    await ask('>>> Tekan Enter di sini setelah halaman "Uploads" tampil... ');
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
  }
  console.log('Login OK, sesi tersimpan di', PROFILE);

  // --- 2. Upload file gambar ---
  console.log(`\nMeng-upload ${files.length} file...`);
  await pickFiles(page, () => page.getByRole('button', { name: /^upload$/i }).first().click(), files, 'upload gambar');
  console.log('Tunggu sampai semua file selesai ter-upload & diproses (lihat progress di browser, bisa beberapa menit).');
  await ask('Tekan Enter jika semua file sudah muncul di daftar Uploads... ');

  // --- 3. Upload CSV metadata ---
  if (csv) {
    console.log('\nMeng-upload CSV metadata...');
    await page.getByText(/upload csv/i).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await pickFiles(page, () => page.getByRole('dialog').getByText(/browse|choose|select/i).first().click(), [csv], 'CSV');
    await page.waitForTimeout(1000);
    await page.getByRole('dialog').getByRole('button', { name: /^upload$/i }).click().catch(() => {});
    console.log('CSV dikirim. Adobe butuh beberapa menit untuk menerapkan judul & keyword.');
  }

  // --- 4. Berhenti sebelum Submit ---
  console.log(`
=== SELESAI OTOMATIS. Langkah terakhir MANUAL di browser ===
1. Refresh halaman Uploads, pastikan judul & keyword sudah terisi.
2. File type: EPS -> "Vectors", JPG -> "Illustrations".
3. "Created using generative AI tools?" -> No (karya dibuat dari kode).
4. Centang semua -> Submit.`);
  await ask('\nTekan Enter untuk menutup browser (sesi login tetap tersimpan)... ');
  await ctx.close();
}

main().then(() => rl && rl.close()).catch((e) => { console.error('\nERROR:', e.message); process.exit(1); });
