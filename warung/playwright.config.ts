import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const PORT = 5179;
// Preinstalled Chromium in the dev container (never `playwright install` there); elsewhere the bundled browser.
const CHROMIUM = '/opt/pw-browsers/chromium';

// Run through `npm run e2e`, which starts the Auth + Firestore emulators and seeds them first.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results',
  use: {
    ...devices['Pixel 5'],
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'off',
    launchOptions: existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {},
  },
  webServer: {
    command: `vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      VITE_EMULATOR: '1',
      VITE_FIREBASE_PROJECT_ID: 'demo-warung',
      VITE_FIREBASE_API_KEY: 'demo-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-warung.firebaseapp.com',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-warung.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '0',
      VITE_FIREBASE_APP_ID: 'demo-app',
    },
  },
});
