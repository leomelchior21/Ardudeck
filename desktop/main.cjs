/**
 * Ardu OS desktop shell.
 *
 * Responsibilities:
 *  - start the local FastAPI backend automatically (production)
 *  - wait until /api/health is OK before showing the window
 *  - never expose localhost: the window only ever shows the UI
 *  - recover from a backend crash by offering a retry
 *  - stop the backend cleanly when the app closes
 *  - never start a second backend if one is already healthy
 *
 * Development (`ARDU_OS_DEV_URL`) assumes `npm run dev` already runs the API
 * and the Vite server; this process then only hosts the window.
 */
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const API_URL = 'http://127.0.0.1:8080';
const DEV_URL = process.env.ARDU_OS_DEV_URL || null;

if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
  app.setPath('userData', path.join(process.env.LOCALAPPDATA, 'ArduOS'));
}

let backend = null;
let quitting = false;
let mainWindow = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function checkHealth() {
  return new Promise((resolve) => {
    const request = http.get(`${API_URL}/api/health`, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on('error', () => resolve(false));
    request.setTimeout(800, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForBackend(timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await checkHealth()) return true;
    await sleep(400);
  }
  return false;
}

function findPython() {
  const candidates = [];
  const repoVenv =
    process.platform === 'win32'
      ? path.resolve(__dirname, '..', 'services', 'hardware-api', '.venv', 'Scripts', 'python.exe')
      : path.resolve(__dirname, '..', 'services', 'hardware-api', '.venv', 'bin', 'python');
  candidates.push(repoVenv);
  if (process.env.ARDU_OS_PYTHON) candidates.push(process.env.ARDU_OS_PYTHON);
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

function resolveBackend() {
  if (app.isPackaged) {
    const resources = process.resourcesPath;
    const executable = path.join(resources, 'backend', 'ardu-os-api.exe');
    if (fs.existsSync(executable)) {
      return { command: executable, args: [], cwd: path.dirname(executable), source: 'bundle' };
    }
    const source = path.join(resources, 'backend-src');
    if (fs.existsSync(source)) {
      return {
        command: findPython(),
        args: ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8080'],
        cwd: source,
        source: 'system-python',
      };
    }
    return null;
  }

  const source = path.resolve(__dirname, '..', 'services', 'hardware-api');
  return {
    command: findPython(),
    args: ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8080'],
    cwd: source,
    source: 'repo',
  };
}

function stopBackend() {
  if (!backend || backend.exitCode !== null) return;
  const pid = backend.pid;
  backend = null;
  if (process.platform === 'win32' && pid !== undefined) {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } else {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // The process is already gone.
    }
  }
}

function backendEnvironment() {
  if (!app.isPackaged) return { ...process.env, ARDU_OS_DESKTOP: '1', PYTHONUNBUFFERED: '1' };
  const resources = process.resourcesPath;
  const dataRoot = path.join(app.getPath('userData'), 'data');
  const env = {
    ...process.env,
    ARDU_OS_DESKTOP: '1',
    PYTHONUNBUFFERED: '1',
    ARDUDECK_DATA_DIR: dataRoot,
    ARDUDECK_LOG_DIR: path.join(app.getPath('userData'), 'logs'),
    ARDUDECK_WORK_DIR: path.join(dataRoot, 'work'),
    ARDUDECK_UI_DIST: path.join(resources, 'ui'),
    ARDUDECK_BRIDGE_SKETCH: path.join(resources, 'firmware', 'ardudeck-bridge'),
  };
  const bundledCli = path.join(resources, 'tools', 'arduino-cli.exe');
  if (fs.existsSync(bundledCli)) env.ARDUDECK_ARDUINO_CLI = bundledCli;
  return env;
}

async function ensureBackend() {
  if (DEV_URL) return true;
  if (await checkHealth()) return true;

  const resolved = resolveBackend();
  if (!resolved) return false;

  backend = spawn(resolved.command, resolved.args, {
    cwd: resolved.cwd,
    stdio: 'ignore',
    windowsHide: true,
    env: backendEnvironment(),
  });
  backend.on('exit', () => {
    backend = null;
    if (!quitting && mainWindow) {
      void mainWindow.loadURL(
        errorPage('The local engine stopped. Close Ardu OS and open it again.'),
      );
    }
  });

  return waitForBackend(30000);
}

function errorPage(message) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ardu OS</title>
  <style>
    body { margin:0; height:100vh; display:grid; place-items:center; background:#131118;
           color:#f5f2ea; font-family:'Segoe UI',system-ui,sans-serif; }
    main { max-width:560px; padding:32px; text-align:center; }
    h1 { font-size:30px; margin:0 0 10px; }
    p { color:#a49fb4; line-height:1.5; }
    code { background:#262230; padding:3px 7px; border-radius:6px; color:#c9f24b; }
  </style></head><body><main>
    <h1>Ardu OS could not start its engine.</h1>
    <p>${message}</p>
    <p>Close this window and open Ardu OS again. If it keeps happening, ask a teacher
    to check that Python and the backend dependencies are installed.</p>
  </main></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

async function boot() {
  const ok = await ensureBackend();
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#131118',
    show: false,
    autoHideMenuBar: true,
    title: 'Ardu OS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (!ok) {
    await mainWindow.loadURL(
      errorPage(
        'The local backend did not answer on <code>127.0.0.1:8080</code> within 30 seconds.',
      ),
    );
    return;
  }

  await mainWindow.loadURL(DEV_URL || API_URL);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    ipcMain.on('ardu-os:window', (event, action) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return;
      if (action === 'minimize') win.minimize();
      else if (action === 'maximize') {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
      } else if (action === 'close') win.close();
    });
    void boot();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void boot();
    });
  });

  app.on('window-all-closed', () => {
    quitting = true;
    stopBackend();
    app.quit();
  });

  app.on('before-quit', () => {
    quitting = true;
    stopBackend();
  });

  process.on('exit', stopBackend);
}
