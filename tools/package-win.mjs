/**
 * Ardu OS Windows packaging.
 *
 *   npm run desktop:package
 *
 * Steps:
 *  1. build the UI into apps/ui/dist
 *  2. build the FastAPI sidecar with PyInstaller when it is available
 *  3. run electron-builder for the Windows installer + portable build
 *
 * PyInstaller is optional: without it the installer still builds and the
 * desktop shell falls back to a system Python with the bundled backend
 * sources. With it, the installed app carries its own Python engine and does
 * not depend on anything being installed on the school notebook.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiDir, isWindows, repoRoot, venvPython } from './python.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.join(repoRoot, 'desktop');
const backendDist = path.join(desktopDir, 'backend-dist');

function run(command, args, options = {}) {
  process.stdout.write(`[package] ${command} ${args.join(' ')}\n`);
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) {
    process.stdout.write(`[package] could not run ${command}: ${result.error.message}\n`);
  }
  return result.status ?? 1;
}

function hasPyInstaller(python) {
  const probe = spawnSync(python, ['-m', 'PyInstaller', '--version'], { stdio: 'pipe' });
  return probe.status === 0;
}

if (
  run(isWindows ? 'npm.cmd' : 'npm', ['run', 'build'], { cwd: repoRoot, shell: isWindows }) !== 0
) {
  process.exit(1);
}

run(process.execPath, [path.join(here, 'make-icon.mjs')], { cwd: repoRoot });

mkdirSync(backendDist, { recursive: true });

const entry = path.join(desktopDir, 'backend_entry.py');
writeFileSync(
  entry,
  [
    '"""Ardu OS bundled backend entry point."""',
    'from app.main import app',
    'import uvicorn',
    '',
    "if __name__ == '__main__':",
    "    uvicorn.run(app, host='127.0.0.1', port=8080, log_level='info')",
    '',
  ].join('\n'),
);

if (hasPyInstaller(venvPython())) {
  const status = run(
    venvPython(),
    [
      '-m',
      'PyInstaller',
      '--noconfirm',
      '--clean',
      '--name',
      'ardu-os-api',
      '--onedir',
      '--distpath',
      backendDist,
      '--workpath',
      path.join(desktopDir, '.pyinstaller'),
      '--specpath',
      path.join(desktopDir, '.pyinstaller'),
       '--paths',
       apiDir,
       '--collect-submodules',
       'serial',
       '--collect-submodules',
       'uvicorn',
       '--collect-submodules',
       'websockets',
       entry,
    ],
    { cwd: apiDir },
  );
  if (status !== 0) {
    process.stdout.write('[package] PyInstaller failed; continuing with source fallback.\n');
  }
} else {
  process.stdout.write(
    '[package] PyInstaller not found in the backend venv; the installer will use\n' +
      '[package] system Python with the bundled backend source instead.\n' +
      '[package] For a self-contained app: pip install pyinstaller in services/hardware-api/.venv\n',
  );
  writeFileSync(
    path.join(backendDist, 'README.txt'),
    'Built without PyInstaller. The desktop shell will look for system Python.\n',
  );
}

const builder = path.join(repoRoot, 'node_modules', '.bin', isWindows ? 'electron-builder.cmd' : 'electron-builder');
if (!existsSync(builder)) {
  process.stdout.write(
    '[package] electron-builder is not installed. Run: npm install --workspace @arduos/desktop\n',
  );
  process.exit(1);
}

const status = run(builder, ['--win', 'nsis', 'portable'], { cwd: desktopDir, shell: isWindows });
process.exit(status);
