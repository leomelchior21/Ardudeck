import { useSyncExternalStore } from 'react';

/**
 * Tiny external store. Telemetry updates ten times per second on a Raspberry
 * Pi 3, so nothing may re-render unless it actually selects changed data.
 */
export interface Store<T> {
  get(): T;
  set(next: T | ((previous: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => state,
    set: (next) => {
      const resolved = typeof next === 'function' ? (next as (previous: T) => T)(state) : next;
      if (Object.is(resolved, state)) return;
      state = resolved;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Selectors must return primitives or stable references (use an id, a number,
 * a string) - never a freshly built object - or React will re-render forever.
 */
export function useStore<T, S>(store: Store<T>, selector: (state: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
