/**
 * Ardu OS desktop development runner.
 *
 * Starts the normal dev stack (FastAPI + Vite) and then opens the Electron
 * shell against the Vite server. In production the shell starts the backend
 * itself; in development the two processes stay separate so hot reload keeps
 * working.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isWindows, repoRoot } from './python.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const children = [];

function shutdown(code) {
  for (const child of children) {
    if (child.exitCode === null && child.pid !== undefined) {
      if (isWindows) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else child.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(code), 300).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function reachable(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode !== undefined && response.statusCode < 500);
    });
    request.on('error', () => resolve(false));
    request.setTimeout(800, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitFor(url, label, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await reachable(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  process.stdout.write(`[desktop] ${label} did not answer in time (${url})\n`);
  return false;
}

let electronPath;
try {
  electronPath = require('electron');
} catch {
  process.stdout.write(
    '[desktop] Electron is not installed yet. Run: npm install --workspace @arduos/desktop\n',
  );
  process.exit(1);
}

const dev = spawn(process.execPath, [path.join(here, 'dev.mjs')], {
  cwd: repoRoot,
  stdio: 'inherit',
});
children.push(dev);

const uiReady = await waitFor('http://localhost:5173', 'Vite', 60000);
const apiReady = await waitFor('http://127.0.0.1:8080/api/health', 'API', 60000);
if (!uiReady || !apiReady) shutdown(1);

process.stdout.write('[desktop] opening Ardu OS window\n');
const electron = spawn(electronPath, ['.'], {
  cwd: path.join(repoRoot, 'desktop'),
  stdio: 'inherit',
  env: { ...process.env, ARDU_OS_DEV_URL: 'http://localhost:5173' },
});
children.push(electron);

electron.on('exit', (code) => shutdown(code ?? 0));
