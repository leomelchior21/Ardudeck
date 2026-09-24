import { ApiError } from '../services/api';
import { createStore } from './store';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'warn' | 'error';
  hint?: string;
}

export const toasts = createStore<Toast[]>([]);

let nextId = 1;

export function showToast(
  message: string,
  tone: Toast['tone'] = 'info',
  hint?: string,
): void {
  const id = nextId;
  nextId += 1;
  const toast: Toast = hint === undefined ? { id, message, tone } : { id, message, tone, hint };
  toasts.set((list) => [...list, toast]);
  window.setTimeout(
    () => {
      toasts.set((list) => list.filter((entry) => entry.id !== id));
    },
    tone === 'error' ? 7000 : 4000,
  );
}

export function showError(error: unknown): void {
  if (error instanceof ApiError) {
    showToast(error.message, 'error', error.hint);
    return;
  }
  showToast('Something went wrong.', 'error', 'Try again.');
}
