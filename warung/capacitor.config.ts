import type { CapacitorConfig } from '@capacitor/cli';

// The Android app is a thin wrapper around the deployed Vercel site: set WARUNG_URL (e.g.
// https://warung-xyz.vercel.app) when running `npx cap sync`. Unset, the app uses the bundled dist/.
const config: CapacitorConfig = {
  appId: 'id.warung.pecellele',
  appName: 'Warung',
  webDir: 'dist',
  server: { url: process.env.WARUNG_URL, cleartext: false },
};

export default config;
