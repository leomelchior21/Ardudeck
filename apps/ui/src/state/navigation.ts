import { createStore } from './store';

/**
 * Ardu OS navigation is deliberately shallow:
 *
 *   Ardu OS launcher  ->  app  ->  work (flow, live, deploy...)
 *
 * The `codeFrom` field remembers whether the code screen was opened from the
 * flow or from the deploy screen, so Back always lands where it started.
 */
export type ScreenName =
  | 'boot'
  | 'os'
  | 'home'
  | 'live'
  | 'flow'
  | 'test'
  | 'deploy'
  | 'code'
  | 'projects'
  | 'teacher'
  | 'learn'
  | 'world'
  | 'quest';

export interface NavigationState {
  screen: ScreenName;
  codeFrom: 'deploy' | 'flow';
  /** Set by the canvas Simulate button so Test Live starts in simulation. */
  testSimulate: boolean;
}

export const navigation = createStore<NavigationState>({
  screen: 'boot',
  codeFrom: 'flow',
  testSimulate: false,
});

export function go(screen: ScreenName): void {
  navigation.set((state) => ({ ...state, screen, testSimulate: false }));
}

export function openCode(from: 'deploy' | 'flow'): void {
  navigation.set((state) => ({ ...state, screen: 'code', codeFrom: from }));
}

export function goTestLive(simulate: boolean): void {
  navigation.set((state) => ({ ...state, screen: 'test', testSimulate: simulate }));
}
