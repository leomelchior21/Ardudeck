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
import net from 'node:net';
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

/** The first free port at or after `start`, so another dev server on 5173 is fine. */
function freePort(start) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(freePort(start + 1)));
    server.listen(start, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : start;
      server.close(() => resolve(port));
    });
  });
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

const uiPort = process.env.ARDUDECK_UI_PORT
  ? Number(process.env.ARDUDECK_UI_PORT)
  : await freePort(5173);
const uiUrl = `http://localhost:${uiPort}`;

const dev = spawn(process.execPath, [path.join(here, 'dev.mjs')], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: { ...process.env, ARDUDECK_UI_PORT: String(uiPort) },
});
children.push(dev);

const uiReady = await waitFor(uiUrl, 'Vite', 90000);
// The first run may install Python dependencies before the API can answer.
const apiReady = await waitFor('http://127.0.0.1:8080/api/health', 'API', 240000);

if (!uiReady || !apiReady) {
  shutdown(1);
} else {
  process.stdout.write('[desktop] opening Ardu OS window\n');
  const electron = spawn(electronPath, ['.'], {
    cwd: path.join(repoRoot, 'desktop'),
    stdio: 'inherit',
    env: { ...process.env, ARDU_OS_DEV_URL: uiUrl },
  });
  children.push(electron);

  electron.on('exit', (code) => shutdown(code ?? 0));
}
