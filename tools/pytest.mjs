import { ensureEnvironment, runPython } from './python.mjs';

ensureEnvironment();
const extra = process.argv.slice(2);
process.exit(runPython(['-m', 'pytest', '-q', ...extra]));
