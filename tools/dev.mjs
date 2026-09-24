import { spawn } from 'node:child_process';
import path from 'node:path';
import { apiDir, ensureEnvironment, isWindows, repoRoot, venvPython } from './python.mjs';

const flags = new Set(process.argv.slice(2));
const runApi = !flags.has('--ui-only');
const runUi = !flags.has('--api-only');

const colors = {
  api: '\u001b[36m',
  ui: '\u001b[35m',
  reset: '\u001b[0m',
};
const children = [];

function prefixed(name, stream, target) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    let index = buffer.indexOf('\n');
    while (index >= 0) {
      const line = buffer.slice(0, index).replace(/\r$/, '');
      buffer = buffer.slice(index + 1);
      target.write(`${colors[name]}[${name}]${colors.reset} ${line}\n`);
      index = buffer.indexOf('\n');
    }
  });
}

function launch(name, command, args, options) {
  const child = spawn(command, args, options);
  prefixed(name, child.stdout, process.stdout);
  prefixed(name, child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${colors[name]}[${name}]${colors.reset} exited with code ${code}\n`);
    if (code !== 0 && code !== null) shutdown(1);
  });
  children.push(child);
  return child;
}

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

if (runApi) {
  ensureEnvironment();
  process.stdout.write('[dev] API  http://127.0.0.1:8080/api/health\n');
  launch(
    'api',
    venvPython(),
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8080', '--reload'],
    { cwd: apiDir },
  );
}

if (runUi) {
  process.stdout.write('[dev] UI   http://localhost:5173\n');
  const npm = isWindows ? 'npm.cmd' : 'npm';
  launch('ui', npm, ['run', 'dev', '--workspace', '@ardudeck/ui'], {
    cwd: repoRoot,
    shell: isWindows,
    env: { ...process.env, FORCE_COLOR: '1' },
  });
}

process.stdout.write(`[dev] repo ${path.relative(process.cwd(), repoRoot) || '.'}\n`);
