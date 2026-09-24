import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(here, '..');
export const apiDir = path.join(repoRoot, 'services', 'hardware-api');
export const venvDir = path.join(apiDir, '.venv');
export const isWindows = process.platform === 'win32';

export function venvPython() {
  return isWindows
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python');
}

function findSystemPython() {
  const candidates = isWindows
    ? [
        { cmd: 'py', prefix: ['-3'] },
        { cmd: 'python', prefix: [] },
      ]
    : [
        { cmd: 'python3', prefix: [] },
        { cmd: 'python', prefix: [] },
      ];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate.cmd, [...candidate.prefix, '--version'], {
      stdio: 'pipe',
      encoding: 'utf8',
    });
    if (probe.status === 0) return candidate;
  }
  return null;
}

function requirementsHash() {
  const files = ['requirements.txt', 'requirements-dev.txt'];
  const hash = createHash('sha1');
  for (const file of files) {
    const fullPath = path.join(apiDir, file);
    hash.update(file);
    hash.update(existsSync(fullPath) ? readFileSync(fullPath) : '');
  }
  return hash.digest('hex');
}

export function ensureEnvironment({ quiet = false } = {}) {
  const log = (message) => {
    if (!quiet) process.stdout.write(`[setup] ${message}\n`);
  };

  if (!existsSync(venvPython())) {
    const system = findSystemPython();
    if (!system) {
      throw new Error(
        'Python 3.10+ was not found on PATH. Install it from https://python.org and re-run.',
      );
    }
    log(`creating virtual environment in ${path.relative(repoRoot, venvDir)}`);
    const result = spawnSync(system.cmd, [...system.prefix, '-m', 'venv', venvDir], {
      stdio: 'inherit',
    });
    if (result.status !== 0) throw new Error('Failed to create the Python virtual environment.');
  }

  const marker = path.join(venvDir, '.ardudeck-deps');
  const wanted = requirementsHash();
  if (existsSync(marker) && readFileSync(marker, 'utf8').trim() === wanted) return;

  log('installing Python dependencies');
  const pip = spawnSync(
    venvPython(),
    ['-m', 'pip', 'install', '--disable-pip-version-check', '-q', '-r', 'requirements.txt', '-r', 'requirements-dev.txt'],
    { cwd: apiDir, stdio: 'inherit' },
  );
  if (pip.status !== 0) throw new Error('Failed to install Python dependencies.');
  writeFileSync(marker, wanted);
}

export function runPython(args, options = {}) {
  const result = spawnSync(venvPython(), args, {
    cwd: options.cwd ?? apiDir,
    stdio: 'inherit',
    env: { ...process.env, ...options.env },
  });
  return result.status ?? 1;
}
