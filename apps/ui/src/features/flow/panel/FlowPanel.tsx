import { useState } from 'react';
import type { CompileResult, Flow } from '@ardudeck/core';
import {
  cancelDeploy,
  deploy as deployStore,
  dismissDeploy,
  sendToTheArduino,
  stopLive,
} from '../../../state/deploy';
import { useStore } from '../../../state/store';
import { Icon } from '../../../ui/Icon';
import { CodeCheckPanel } from './CodeCheckPanel';
import { DeployPanel } from './DeployPanel';
import { LivePanel } from './LivePanel';

export function FlowPanel({
  flow,
  compiled,
  deployedCode,
  changedSinceDeploy,
  collapsed,
  onToggleCollapse,
}: {
  flow: Flow;
  compiled: CompileResult;
  deployedCode: string | null;
  changedSinceDeploy: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const phase = useStore(deployStore, (state) => state.phase);
  const live = useStore(deployStore, (state) => state.live);
  const [view, setView] = useState<'auto' | 'code'>('auto');

  const program = compiled.program;
  const title = phase === 'idle' ? 'Code Check' : 'Deploy to Arduino';
  const status =
    live === 'streaming'
      ? { label: 'Live', tone: 'live' }
      : phase === 'failed'
        ? { label: 'Error', tone: 'error' }
        : phase === 'deploying'
          ? { label: 'Sending', tone: 'busy' }
          : compiled.ok
            ? { label: 'Ready', tone: 'ok' }
            : { label: 'Check', tone: 'warn' };

  const send = () => {
    if (!program || !compiled.sketch) return;
    void sendToTheArduino(flow.name, compiled.sketch.code, program);
  };

  if (collapsed) {
    return (
      <aside className="fb-panel fb-panel--collapsed">
        <button
          type="button"
          className="fb-icon-button"
          aria-label="Expand panel"
          onClick={onToggleCollapse}
        >
          <Icon name="chevron-down" size={18} strokeWidth={2.4} />
        </button>
        <span className="fb-panel-collapsed-label">{title}</span>
        <span className={`fb-panel-status fb-panel-status--${status.tone}`}>●</span>
      </aside>
    );
  }

  const deploying = phase === 'deploying' || phase === 'failed';
  const liveActive = phase === 'deployed';

  return (
    <aside className="fb-panel">
      <header className="fb-panel-head">
        {phase === 'failed' ? (
          <button
            type="button"
            className="fb-icon-button"
            aria-label="Back to code"
            title="Back to code"
            onClick={() => {
              dismissDeploy();
              setView('auto');
            }}
          >
            <Icon name="back" size={18} strokeWidth={2.4} />
          </button>
        ) : null}
        <div>
          <h2>{title}</h2>
        </div>
        <span className={`fb-panel-status fb-panel-status--${status.tone}`}>
          <span className="fb-status-dot" />
          {status.label}
        </span>
        <button
          type="button"
          className="fb-icon-button"
          aria-label="Collapse panel"
          onClick={onToggleCollapse}
        >
          <Icon name="chevron-up" size={18} strokeWidth={2.4} />
        </button>
      </header>

      {deploying ? (
        <DeployPanel
          compiled={compiled}
          onRetry={send}
          onCancel={() => void cancelDeploy()}
          onBack={() => {
            dismissDeploy();
            setView('auto');
          }}
        />
      ) : liveActive && view === 'auto' ? (
        <LivePanel
          flow={flow}
          compiled={compiled}
          changedSinceDeploy={changedSinceDeploy}
          onViewCode={() => setView('code')}
          onReupload={send}
          onStopLive={() => void stopLive()}
        />
      ) : (
        <CodeCheckPanel
          flow={flow}
          compiled={compiled}
          runningCode={deployedCode}
          liveActive={liveActive}
          changedSinceDeploy={changedSinceDeploy}
          onSend={send}
          onBackToLive={() => setView('auto')}
        />
      )}
    </aside>
  );
}
