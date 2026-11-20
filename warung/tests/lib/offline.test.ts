import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../capacitor.config';

describe('APK offline page', () => {
  it('the Android wrapper shows the bundled offline page when the site cannot load', () => {
    expect(config.server?.errorPath).toBe('offline.html');
  });

  it('offline.html is bundled from public/ with plain Indonesian and a Coba lagi button back to the app', () => {
    const html = readFileSync(resolve(__dirname, '../../public/offline.html'), 'utf8');
    expect(html).toContain('<html lang="id">');
    expect(html).toContain('Tidak ada sinyal. Cek internet lalu ketuk Coba lagi.');
    expect(html).toMatch(/<button[^>]*>Coba lagi<\/button>/);
    // Reloading would only reload this local page; going to the root loads the site again.
    expect(html).toContain("location.replace('/')");
  });
});
