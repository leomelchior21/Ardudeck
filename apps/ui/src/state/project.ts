import { compileFlow, createFlow, parseFlow } from '@ardudeck/core';
import type { CompileResult, Flow } from '@ardudeck/core';
import { api } from '../services/api';
import { createStore } from './store';
import { showError } from './toast';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface ProjectState {
  flow: Flow;
  dirty: boolean;
  saveState: SaveState;
  savedAt: string | null;
  deployedAt: string | null;
  /** Exact C++ currently flashed by the last successful upload. */
  deployedCode: string | null;
  open: boolean;
}

export const project = createStore<ProjectState>({
  flow: createFlow('My first project'),
  dirty: false,
  saveState: 'idle',
  savedAt: null,
  deployedAt: null,
  deployedCode: null,
  open: false,
});

/**
 * Compilation is memoised on the parts of the flow that affect generated code,
 * so dragging a block around never re-runs the compiler.
 */
let compiledKey = '';
let compiled: CompileResult | null = null;

export function compileKey(flow: Flow): string {
  const nodes = flow.nodes
    .map((node) => `${node.id}:${node.componentId}:${JSON.stringify(node.config)}`)
    .join('|');
  const edges = flow.edges
    .map((edge) => `${edge.source}>${edge.target}:${edge.branch ?? 'true'}`)
    .join('|');
  return `${flow.name}#${nodes}#${edges}`;
}

export function getCompiled(flow: Flow): CompileResult {
  const key = compileKey(flow);
  if (compiled === null || key !== compiledKey) {
    compiled = compileFlow(flow);
    compiledKey = key;
  }
  return compiled;
}

export function setFlow(flow: Flow): void {
  project.set((state) => ({ ...state, flow, dirty: true, saveState: 'idle' }));
  scheduleSave();
}

export function renameProject(name: string): void {
  const trimmed = name.trim();
  if (trimmed.length === 0) return;
  project.set((state) => ({ ...state, flow: { ...state.flow, name: trimmed }, dirty: true }));
  scheduleSave();
}

export function newProject(name = 'My first project'): void {
  project.set({
    flow: createFlow(name),
    dirty: false,
    saveState: 'idle',
    savedAt: null,
    deployedAt: null,
    deployedCode: null,
    open: false,
  });
}

export function markDeployed(code: string): void {
  const timestamp = new Date().toISOString();
  project.set((state) => ({
    ...state,
    deployedAt: timestamp,
    deployedCode: code,
    saveState: 'saving',
  }));
  void persist({ code, deployedAt: timestamp });
}

export async function openProject(id: string): Promise<void> {
  const { project: record } = await api.project(id);
  if (record.malformed || record.flow === null) {
    throw new Error('This saved project could not be opened.');
  }
  const parsed = parseFlow(record.flow);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const flow = { ...parsed.flow, id: record.id, name: record.name };
  project.set({
    flow,
    dirty: false,
    saveState: 'saved',
    savedAt: record.updatedAt,
    deployedAt: record.deployedAt,
    deployedCode: record.code,
    open: true,
  });
  compiled = null;
  compiledKey = '';
}

let saveTimer: number | null = null;

function scheduleSave(): void {
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    void saveNow();
  }, 1500);
}

interface PersistOptions {
  code?: string;
  deployedAt?: string;
  keepalive?: boolean;
  silent?: boolean;
}

async function persist(options: PersistOptions = {}): Promise<void> {
  const state = project.get();
  const payload: {
    name: string;
    flow: unknown;
    code?: string | null;
    deployedAt?: string | null;
  } = { name: state.flow.name, flow: state.flow };
  if (options.code !== undefined) payload.code = options.code;
  if (options.deployedAt !== undefined) payload.deployedAt = options.deployedAt;

  project.set((current) => ({ ...current, saveState: 'saving' }));
  try {
    const saved = await api.saveProject(state.flow.id, payload, options.keepalive ?? false);
    project.set((current) => ({
      ...current,
      dirty: false,
      saveState: 'saved',
      savedAt: saved.project.updatedAt,
    }));
  } catch (error) {
    project.set((current) => ({ ...current, saveState: 'error' }));
    if (!options.silent) showError(error);
  }
}

export async function saveNow(options: PersistOptions = {}): Promise<void> {
  if (saveTimer !== null) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
  await persist(options);
}

export function initAutosave(): void {
  window.addEventListener('pagehide', () => {
    if (project.get().dirty) void persist({ keepalive: true, silent: true });
  });
}

export function formatSavedAt(iso: string | null): string {
  if (!iso) return 'not saved yet';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'saved';
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'saved just now';
  if (minutes === 1) return 'saved 1 minute ago';
  if (minutes < 60) return `saved ${minutes} minutes ago`;
  return `saved at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}
