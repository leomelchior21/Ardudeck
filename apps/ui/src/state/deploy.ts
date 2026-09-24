import type { IrProgram } from '@ardudeck/core';
import { ApiError, api } from '../services/api';
import type { DeployJob } from '../services/types';
import { subscribeSocket } from '../services/ws';
import { markDeployed } from './project';
import { createStore } from './store';
import { applyRuntime, clearTelemetry } from './telemetry';

export type DeployPhase = 'idle' | 'deploying' | 'deployed' | 'failed';
export type LivePhase = 'inactive' | 'starting' | 'streaming' | 'paused' | 'disconnected';

export interface DeployStoreState {
  phase: DeployPhase;
  job: DeployJob | null;
  live: LivePhase;
  message: string | null;
  /** Id of the flow this state belongs to, so a new project starts clean. */
  flowId: string | null;
}

export const deploy = createStore<DeployStoreState>({
  phase: 'idle',
  job: null,
  live: 'inactive',
  message: null,
  flowId: null,
});

let pending: { name: string; code: string; program: IrProgram } | null = null;
let pollTimer: number | null = null;
let started = false;

function patch(next: Partial<DeployStoreState>): void {
  deploy.set((state) => ({ ...state, ...next }));
}

function stopPolling(): void {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling(): void {
  if (pollTimer !== null) return;
  pollTimer = window.setInterval(() => {
    void api
      .deployCurrent()
      .then((result) => {
        if (result.job) handleJob(result.job);
      })
      .catch(() => undefined);
  }, 900);
}

function friendlyDeployError(job: DeployJob): string {
  const failed = job.steps.find((step) => step.status === 'error');
  if (failed?.message) return failed.message;
  if (job.error?.message) return job.error.message;
  return 'The upload did not finish. Check the USB cable and try again.';
}

function finishDeploy(job: DeployJob): void {
  stopPolling();
  patch({ phase: 'deployed', job, message: null });
  if (pending) {
    markDeployed(pending.code);
    void enterLive(pending.program);
  }
}

async function startRuntime(): Promise<void> {
  if (!pending) return;
  try {
    const payload = await api.runtimeStart(pending.program, false);
    applyRuntime(payload.runtime);
    patch({ live: 'streaming', message: null });
  } catch (error) {
    const message =
      error instanceof ApiError
        ? `${error.message}${error.hint ? ` ${error.hint}` : ''}`
        : 'Live mode could not start.';
    patch({ live: 'paused', message });
  }
}

/** Live mode: the board runs ArduDeck Bridge and the computer evaluates the flow. */
async function enterLive(program: IrProgram): Promise<void> {
  pending = pending ? { ...pending, program } : pending;
  patch({ live: 'starting', message: null });
  try {
    const payload = await api.installBridge();
    handleJob(payload.job);
  } catch (error) {
    const message =
      error instanceof ApiError
        ? `${error.message}${error.hint ? ` ${error.hint}` : ''}`
        : 'The Arduino could not be prepared for live mode.';
    patch({ live: 'paused', message });
  }
}

function handleJob(job: DeployJob): void {
  const state = deploy.get();
  if (job.kind === 'deploy') {
    if (state.phase === 'deploying' && job.status === 'running') {
      patch({ job });
      return;
    }
    if (state.phase === 'deploying' && job.status === 'ok') {
      finishDeploy(job);
      return;
    }
    if (state.phase === 'deploying' && (job.status === 'error' || job.status === 'cancelled')) {
      stopPolling();
      patch({ phase: 'failed', job, message: friendlyDeployError(job) });
      return;
    }
    patch({ job });
    return;
  }

  if (job.kind === 'bridge') {
    if (state.live === 'starting') {
      if (job.status === 'ok') {
        patch({ job });
        void startRuntime();
        return;
      }
      if (job.status === 'error' || job.status === 'cancelled') {
        patch({
          job,
          live: 'paused',
          message: friendlyDeployError(job) || 'The Arduino could not be prepared for live mode.',
        });
        return;
      }
    }
    patch({ job });
  }
}

export function startDeploySync(): void {
  if (started) return;
  started = true;
  subscribeSocket((event) => {
    if (event.type === 'deploy') {
      handleJob(event.job);
      return;
    }
    if (event.type === 'hardware') {
      const state = deploy.get();
      if (state.live === 'streaming' && event.state !== 'ready') {
        patch({ live: 'disconnected' });
      } else if (state.live === 'disconnected' && event.state === 'ready') {
        patch({ live: 'streaming' });
      }
    }
  });
  void api
    .deployCurrent()
    .then((result) => {
      if (result.job) handleJob(result.job);
    })
    .catch(() => undefined);
}

export function resetDeploy(flowId: string): void {
  const state = deploy.get();
  if (state.flowId === flowId) return;
  stopPolling();
  if (state.flowId !== null && state.live !== 'inactive') void stopLive();
  pending = null;
  patch({ phase: 'idle', job: null, live: 'inactive', message: null, flowId });
}

/** Restores live mode after navigating away and back. */
export async function syncRuntime(): Promise<void> {
  try {
    const payload = await api.runtimeStatus();
    if (payload.runtime.running) {
      applyRuntime(payload.runtime);
      patch({ live: 'streaming' });
    }
  } catch {
    // The backend may still be starting; the hardware store will catch up.
  }
}

export async function sendToTheArduino(
  name: string,
  code: string,
  program: IrProgram,
): Promise<void> {
  pending = { name, code, program };
  patch({ phase: 'deploying', job: null, live: 'inactive', message: null });
  startPolling();
  try {
    const result = await api.deploy(name, code);
    handleJob(result.job);
  } catch (error) {
    stopPolling();
    const message =
      error instanceof ApiError
        ? `${error.message}${error.hint ? ` ${error.hint}` : ''}`
        : 'The upload did not start.';
    patch({ phase: 'failed', job: null, message });
  }
}

export async function cancelDeploy(): Promise<void> {
  try {
    await api.deployCancel();
  } catch {
    // The pipeline may have finished already.
  }
  stopPolling();
  patch({ phase: 'idle', job: null, live: 'inactive', message: null });
}

/**
 * Leaves the deploy view and goes back to writing code. Never interrupts a
 * running upload: the student uses Cancel for that.
 */
export function dismissDeploy(): void {
  const state = deploy.get();
  if (state.phase === 'deploying') return;
  stopPolling();
  pending = null;
  patch({ phase: 'idle', job: null, live: 'inactive', message: null });
}

export async function stopLive(): Promise<void> {
  try {
    await api.runtimeStop();
  } catch {
    // Stopping is best-effort; leave the UI in a stopped state anyway.
  }
  clearTelemetry();
  patch({ live: 'inactive', message: null });
}
