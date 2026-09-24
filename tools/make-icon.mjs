/**
 * Builds desktop/assets/icon.ico from the Ardu OS mark.
 *
 * Electron renders the brand mark into a 256x256 PNG, which is wrapped in a
 * one-image ICO (valid on Windows Vista and newer). The packaging step calls
 * this automatically; run it on its own with `node tools/make-icon.mjs`.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const iconDir = path.join(repoRoot, 'desktop', 'assets');
const iconPath = path.join(iconDir, 'icon.ico');

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; width: 256px; height: 256px; background: transparent; overflow: hidden; }
.tile {
  width: 256px; height: 256px; border-radius: 58px; background: #131118;
  display: grid; place-items: center;
}
svg { width: 168px; height: 158px; }
</style></head><body>
<div class="tile">
  <svg viewBox="0 0 64 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="32" y="5" width="16" height="50" rx="8" transform="rotate(28 40 30)" fill="#6b4df6"/>
    <path d="M22 31 L9 48 L31 50 Z" fill="#c9f24b" stroke="#c9f24b" stroke-width="10"
          stroke-linejoin="round" stroke-linecap="round"/>
  </svg>
</div>
</body></html>`;

const MAIN = `
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');

const html = fs.readFileSync(process.argv[2], 'utf8');
const out = process.argv[3];

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 256,
    height: 256,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    useContentSize: true,
  });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((resolve) => setTimeout(resolve, 600));
  const image = await win.webContents.capturePage();
  const png = image.resize({ width: 256, height: 256 }).toPNG();

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); // width 256
  entry.writeUInt8(0, 1); // height 256
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12); // offset after header + one entry
  fs.writeFileSync(out, Buffer.concat([header, entry, png]));
  app.quit();
});
`;

let electronPath;
try {
  electronPath = require('electron');
} catch {
  process.stdout.write('[icon] Electron is not installed; keeping the default icon.\n');
  process.exit(0);
}

if (!existsSync(iconDir)) mkdirSync(iconDir, { recursive: true });
const htmlPath = path.join(os.tmpdir(), 'arduos-icon.html');
const mainPath = path.join(os.tmpdir(), 'arduos-icon-main.cjs');
writeFileSync(htmlPath, HTML);
writeFileSync(mainPath, MAIN);

const result = spawnSync(electronPath, [mainPath, htmlPath, iconPath], {
  stdio: 'inherit',
  windowsHide: true,
});

if (result.status !== 0 || !existsSync(iconPath)) {
  process.stdout.write('[icon] Could not build the icon; keeping the default one.\n');
  process.exit(0);
}
process.stdout.write(`[icon] wrote ${path.relative(repoRoot, iconPath)}\n`);
