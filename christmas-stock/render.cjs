// Render SVG -> JPG. Usage: node render.js <scale> <outdir>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const scale = +(process.argv[2] || 4), out = process.argv[3] || 'jpg';
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  for (const f of fs.readdirSync('svg').filter(f => f.endsWith('.svg')).sort()) {
    const s = fs.readFileSync(path.join('svg', f), 'utf8');
    const [, w, h] = s.match(/width="(\d+)" height="(\d+)"/);
    const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: scale });
    await page.setContent(`<html><body style="margin:0">${s}</body></html>`);
    await page.screenshot({ path: path.join(out, f.replace('.svg', '.jpg')), type: 'jpeg', quality: 95 });
    await page.close(); console.log(f);
  }
  await browser.close();
})();
