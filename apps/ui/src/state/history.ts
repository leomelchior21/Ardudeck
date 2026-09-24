import type { Flow } from '@ardudeck/core';
import { project, setFlow } from './project';
import { createStore } from './store';

/**
 * Undo/redo for graph edits. Snapshots are plain Flow objects, capped so a
 * long classroom session cannot grow without bound. Node positions are not
 * part of history: dragging a card is not a meaningful edit.
 */
const MAX_DEPTH = 60;

let past: Flow[] = [];
let future: Flow[] = [];

export const history = createStore({ canUndo: false, canRedo: false });

function emit(): void {
  history.set({ canUndo: past.length > 0, canRedo: future.length > 0 });
}

export function record(flow: Flow): void {
  const last = past[past.length - 1];
  if (last && last === flow) return;
  past.push(flow);
  if (past.length > MAX_DEPTH) past.shift();
  future = [];
  emit();
}

export function resetHistory(): void {
  past = [];
  future = [];
  emit();
}

export function undo(): boolean {
  const previous = past.pop();
  if (!previous) return false;
  future.push(project.get().flow);
  setFlow(previous);
  emit();
  return true;
}

export function redo(): boolean {
  const next = future.pop();
  if (!next) return false;
  past.push(project.get().flow);
  setFlow(next);
  emit();
  return true;
}
