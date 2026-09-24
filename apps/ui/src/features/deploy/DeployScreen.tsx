import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/api';
import { ApiError } from '../../services/api';
import type { DeployJob, DeployStep } from '../../services/types';
import { subscribeSocket } from '../../services/ws';
import { go, openCode } from '../../state/navigation';
import { getCompiled, markDeployed, project as projectStore } from '../../state/project';
import { useStore } from '../../state/store';
import { showError, showToast } from '../../state/toast';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Pill } from '../../ui/Pill';
import { TopBar } from '../../ui/TopBar';

const PLANNED_STEPS: DeployStep[] = [
  { id: 'prepare', label: 'Preparing', status: 'pending' },
  { id: 'check', label: 'Checking', status: 'pending' },
  { id: 'compile', label: 'Building', status: 'pending' },
  { id: 'upload', label: 'Uploading', status: 'pending' },
  { id: 'finish', label: 'Ready', status: 'pending' },
];

function StepRow({ step }: { step: DeployStep }) {
  const icon =
    step.status === 'ok'
      ? 'check'
      : step.status === 'error'
        ? 'warning'
        : step.status === 'running'
          ? null
          : 'chevron-down';
  return (
    <div className={`step step--${step.status}`}>
      <span className="step-icon">
        {icon ? <Icon name={icon} size={18} strokeWidth={2.6} /> : <span className="boot-spinner" />}
      </span>
      <span>
        <span className="step-text">{step.message ?? step.label}</span>
        {step.status === 'running' ? <div className="step-message">Working...</div> : null}
      </span>
    </div>
  );
}

export function DeployScreen() {
  const flow = useStore(projectStore, (state) => state.flow);
  const compiled = getCompiled(flow);
  const [job, setJob] = useState<DeployJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const markedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribeSocket((event) => {
      if (event.type === 'deploy') setJob(event.job);
    });
    const poll = async () => {
      try {
        const result = await api.deployCurrent();
        if (result.job) setJob(result.job);
      } catch {
        // The socket may be the only channel that is up; ignore.
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 1500);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  const code = compiled.sketch?.code ?? '';

  useEffect(() => {
    if (job?.status === 'running') {
      markedRef.current = false;
      return;
    }
    if (job?.status === 'ok' && !markedRef.current && code.length > 0) {
      markedRef.current = true;
      markDeployed(code);
      showToast('Your program is running on the Arduino.');
    }
  }, [job, code]);

  const upload = async () => {
    if (code.length === 0) return;
    setBusy(true);
    setDetailsOpen(false);
    try {
      const result = await api.deploy(flow.name, code);
      setJob(result.job);
    } catch (error) {
      if (error instanceof ApiError) {
        showToast(error.message, 'error', error.hint);
      } else {
        showError(error);
      }
      setJob(null);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    try {
      await api.deployCancel();
      showToast('Upload cancelled.');
    } catch (error) {
      showError(error);
    }
  };

  const preview = useMemo(() => {
    if (!compiled.program) return [];
    const items: string[] = [];
    for (const read of compiled.program.reads) {
      items.push(`${read.name}${read.pin ? ` ${read.pin}` : ''}`);
    }
    for (const rule of compiled.program.rules) {
      const symbol = rule.condition.op === 'lt' ? '<' : rule.condition.op === 'gt' ? '>' : '=';
      items.push(`${symbol} ${rule.condition.value}`);
    }
    for (const rule of compiled.program.rules) {
      for (const action of rule.then) {
        if (!items.includes(`${action.name} ${action.pin}`)) {
          items.push(`${action.name} ${action.pin}`);
        }
      }
    }
    return items;
  }, [compiled.program]);

  if (!compiled.ok) {
    return (
      <>
        <TopBar title="Deploy" onBack={() => go('flow')} />
        <div className="screen-body">
          <div className="empty-state">
            <Icon name="warning" size={34} />
            <div className="empty-title">{compiled.validation.summary}</div>
            <div>Fix the highlighted block, then come back.</div>
            <Button variant="primary" onClick={() => go('flow')}>
              BACK TO FLOW
            </Button>
          </div>
        </div>
      </>
    );
  }

  const status = job?.status ?? 'idle';
  const steps: DeployStep[] =
    job && job.kind === 'deploy'
      ? job.steps
      : job && job.kind === 'bridge'
        ? job.steps
        : PLANNED_STEPS;

  return (
    <>
      <TopBar
        title="Deploy"
        subtitle={flow.name}
        onBack={() => go('flow')}
      >
        {status === 'ok' ? <Pill tone="ok">READY</Pill> : null}
        {status === 'running' ? <Pill tone="accent">Working...</Pill> : null}
        {status === 'error' ? <Pill tone="danger">Not sent</Pill> : null}
      </TopBar>

      <div className="screen-body screen-body--scroll">
        <div className="deploy">
          <h1 className="deploy-heading">
            Ready to make it <em>independent</em>
          </h1>

          <div className="deploy-preview">
            {preview.map((item, index) => (
              <span key={`${item}-${index}`} className="node-pin" style={{ fontSize: 14, padding: '6px 10px' }}>
                {item}
              </span>
            ))}
          </div>

          {status === 'ok' ? (
            <div className="deploy-ready">
              <Icon name="check" size={44} strokeWidth={2.6} />
              <div className="deploy-ready-title">Ready ✓</div>
              <div className="hint">
                The program is on the Arduino. You can unplug it and it keeps working.
              </div>
            </div>
          ) : null}

          {status === 'error' && job?.error ? (
            <div className="note note--danger">
              <Icon name="warning" size={20} />
              <div>
                <div style={{ fontWeight: 700 }}>{job.error.message}</div>
                {job.error.hints.map((hint) => (
                  <div key={hint}>· {hint}</div>
                ))}
                {job.error.details ? (
                  <>
                    <button
                      type="button"
                      className="details-toggle"
                      onClick={() => setDetailsOpen((value) => !value)}
                    >
                      {detailsOpen ? 'HIDE DETAILS' : 'DETAILS'}
                    </button>
                    {detailsOpen ? <div className="details-box">{job.error.details}</div> : null}
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="steps">
            {steps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </div>

          <div className="live-actions">
            {status === 'idle' || status === 'error' ? (
              <Button
                variant="primary"
                size="lg"
                className="btn--grow"
                icon="upload"
                onClick={() => void upload()}
                disabled={busy}
              >
                DEPLOY TO ARDUINO
              </Button>
            ) : null}
            {status === 'running' ? (
              <Button variant="danger" size="lg" className="btn--grow" icon="stop" onClick={() => void cancel()}>
                STOP UPLOAD
              </Button>
            ) : null}
            {status === 'ok' ? (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  className="btn--grow"
                  icon="refresh"
                  onClick={() => void upload()}
                  disabled={busy}
                >
                  RUN AGAIN
                </Button>
                <Button
                  size="lg"
                  className="btn--grow"
                  icon="code"
                  onClick={() => openCode('deploy')}
                >
                  VIEW CODE
                </Button>
                <Button size="lg" className="btn--grow" onClick={() => go('flow')}>
                  BACK TO FLOW
                </Button>
              </>
            ) : null}
          </div>

          {status !== 'ok' && status !== 'running' ? (
            <Button icon="code" variant="quiet" onClick={() => openCode('deploy')}>
              VIEW CODE
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}
