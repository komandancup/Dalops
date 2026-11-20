import { expect, test, type Page } from '@playwright/test';

// One full shift against the seeded emulators (see scripts/seed-emulator.ts). Run with `npm run e2e`.

async function masuk(page: Page, username: string) {
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Kata sandi').fill('rahasia1');
  await page.getByRole('button', { name: 'Masuk' }).click();
}

const menu = (page: Page, nama: string) => page.getByRole('button', { name: new RegExp(`^${nama} Rp`) });
const tab = (page: Page, nama: string) => page.getByRole('navigation').getByRole('button', { name: nama });
const angka = (page: Page, label: string) =>
  page.getByRole('region', { name: 'Hari ini' }).getByText(label, { exact: true }).locator('..');

test('satu shift penuh: buka kas, jualan tunai + QRIS, tutup kas, pemilik melihat Beranda', async ({ page }) => {
  await page.goto('/');

  // Budi opens the cash drawer with 100.000.
  await masuk(page, 'budi');
  await page.getByLabel('Modal awal di laci').fill('100000');
  await page.getByLabel('Alasan').fill('modal awal hari ini');
  await page.getByRole('button', { name: 'Buka Kas' }).click();

  // 2 × Pecel Lele + 1 × Es Teh, paid tunai 50.000.
  await menu(page, 'Pecel Lele').click();
  await menu(page, 'Pecel Lele').click();
  await menu(page, 'Es Teh').click();
  await expect(page.getByRole('button', { name: /Lihat pesanan/ })).toContainText('Rp 34.000');
  await page.screenshot({ path: 'test-results/e2e-kasir.png' });
  await page.getByRole('button', { name: /Lihat pesanan/ }).click();
  await page.getByRole('button', { name: 'Bayar Sekarang' }).click();
  await page.getByRole('button', { name: 'Tunai', exact: true }).click();
  await page.getByLabel('Uang diterima').fill('50000');
  await expect(page.getByText('Kembalian').locator('..')).toContainText('Rp 16.000');
  await page.getByRole('button', { name: 'Simpan Lunas' }).click();
  await expect(page.getByRole('status')).toHaveText('Pesanan #1 tersimpan, lunas.');

  // 1 × Ayam Penyet paid by QRIS.
  await menu(page, 'Ayam Penyet').click();
  await page.getByRole('button', { name: /Lihat pesanan/ }).click();
  await page.getByRole('button', { name: 'Bayar Sekarang' }).click();
  await page.getByRole('button', { name: 'QRIS', exact: true }).click();
  const qris = page.getByRole('dialog', { name: 'Bayar QRIS' });
  await expect(qris.getByRole('img', { name: 'Kode QRIS Rp 18.000' })).toBeVisible();
  await expect(qris.getByText('Rp 18.000', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/e2e-qris.png' });
  await qris.getByRole('button', { name: /Sudah masuk/ }).click();
  await expect(page.getByRole('status')).toHaveText('Pesanan #2 tersimpan, lunas.');

  // Close: counted 134.000, QRIS 18.000, hand over 84.000, leave 50.000.
  await tab(page, 'Tutup Kas').click();
  // Blind count: the expected cash is shown only after both counts are typed.
  await expect(page.getByLabel('Uang tunai dihitung')).toBeVisible();
  await expect(page.getByText('Uang tunai seharusnya')).toHaveCount(0);
  await page.getByLabel('Uang tunai dihitung').fill('134000');
  await page.getByLabel('Total QRIS di aplikasi merchant').fill('18000');
  await expect(page.getByText('Uang tunai seharusnya').locator('..')).toContainText('Rp 134.000');
  await page.getByLabel('Ditinggal di laci').fill('50000');
  await page.getByLabel('Disetor ke pemilik').fill('84000');
  await page.getByRole('main').getByRole('button', { name: 'Tutup Kas' }).click();
  await expect(page.getByRole('status')).toContainText('Kas sudah ditutup.');
  await expect(page.getByRole('status')).toContainText('Serahkan Rp 84.000 ke pemilik. Tinggalkan Rp 50.000 di laci');

  // The owner sees the day on Beranda.
  await page.getByRole('button', { name: 'Keluar' }).click();
  await masuk(page, 'pemilik');
  await expect(tab(page, 'Beranda')).toHaveAttribute('aria-current', 'page');
  await expect(angka(page, 'Penjualan')).toContainText('Rp 52.000');
  await expect(angka(page, 'Tunai')).toContainText('Rp 34.000');
  await expect(angka(page, 'QRIS')).toContainText('Rp 18.000');
  await expect(page.getByRole('region', { name: 'Kas' })).toContainText('Tutup');
  await page.screenshot({ path: 'test-results/e2e-beranda.png' });
});
