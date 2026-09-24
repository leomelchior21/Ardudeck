import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
export const fixturesDir = path.resolve(here, '..', '..', 'fixtures');

function normalize(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

/**
 * Fixtures double as the contract between the TypeScript compiler and the
 * Python runtime: the IR fixture is loaded by both test suites.
 *
 * Run with UPDATE_GOLDENS=1 to rewrite them after an intentional change.
 */
export function expectGolden(fileName: string, actual: string): void {
  const filePath = path.join(fixturesDir, fileName);
  const normalized = normalize(actual);
  if (process.env['UPDATE_GOLDENS'] === '1' || !existsSync(filePath)) {
    mkdirSync(fixturesDir, { recursive: true });
    writeFileSync(filePath, normalized, 'utf8');
  }
  expect(normalized).toBe(normalize(readFileSync(filePath, 'utf8')));
}
