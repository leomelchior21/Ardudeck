import type { CompileResult } from '@ardudeck/core';
import { deploy as deployStore } from '../../../state/deploy';
import { useStore } from '../../../state/store';
import { Icon } from '../../../ui/Icon';

type StepStatus = 'pending' | 'running' | 'ok' | 'error';

interface DisplayStep {
  id: string;
  label: string;
  caption: string;
  status: StepStatus;
  message?: string;
  details?: string;
}

function worst(a: StepStatus, b: StepStatus): StepStatus {
  const order: StepStatus[] = ['pending', 'ok', 'running', 'error'];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

export function DeployPanel({
  compiled,
  onRetry,
  onCancel,
  onBack,
}: {
  compiled: CompileResult;
  onRetry: () => void;
  onCancel: () => void;
  onBack: () => void;
}) {
  const phase = useStore(deployStore, (state) => state.phase);
  const job = useStore(deployStore, (state) => state.job);
  const live = useStore(deployStore, (state) => state.live);
  const message = useStore(deployStore, (state) => state.message);

  const stepOf = (id: string) => job?.steps.find((step) => step.id === id);
  const validate = stepOf('prepare');
  const check = stepOf('check');
  const compile = stepOf('compile');
  const upload = stepOf('upload');

  const validateStatus = worst(
    (validate?.status as StepStatus) ?? 'pending',
    (check?.status as StepStatus) ?? 'pending',
  );

  const liveStatus: StepStatus =
    live === 'streaming' ? 'ok' : live === 'starting' ? 'running' : message ? 'error' : 'pending';

  const steps: DisplayStep[] = [
    {
      id: 'validate',
      label: 'Validate',
      caption: 'Checking your flow',
      status: phase === 'deploying' && validateStatus === 'pending' ? 'running' : validateStatus,
      message: validate?.message ?? check?.message,
      details: validate?.details ?? check?.details,
    },
    {
      id: 'compile',
      label: 'Compile',
      caption: 'Building the Arduino program',
      status: (compile?.status as StepStatus) ?? (validateStatus === 'ok' ? 'running' : 'pending'),
      message: compile?.message,
      details: compile?.details,
    },
    {
      id: 'upload',
      label: 'Upload',
      caption: 'Sending it over the USB cable',
      status: (upload?.status as StepStatus) ?? 'pending',
      message: upload?.message,
      details: upload?.details,
    },
    {
      id: 'live',
      label: 'Live Mode',
      caption: 'Watching your system react',
      status: liveStatus,
      message: message ?? undefined,
    },
  ];

  const failed = steps.find((step) => step.status === 'error');
  const running = phase === 'deploying' || live === 'starting';

  return (
    <div className="fb-panel-body">
      <h2 className="fb-panel-heading">Deploy to Arduino</h2>
      <p className="fb-panel-sub">
        {compiled.program?.title ?? 'Your system'} · the Arduino will run this on its own
        until you start live mode.
      </p>

      <ol className="fb-deploy-steps">
        {steps.map((step) => (
          <li key={step.id} className={`fb-deploy-step fb-deploy-step--${step.status}`}>
            <span className="fb-deploy-marker">
              {step.status === 'ok' ? (
                <Icon name="check" size={16} strokeWidth={3} />
              ) : step.status === 'error' ? (
                <Icon name="close-x" size={15} strokeWidth={2.6} />
              ) : step.status === 'running' ? (
                <span className="fb-spinner" />
              ) : (
                <span className="fb-deploy-dot" />
              )}
            </span>
            <span className="fb-deploy-copy">
              <strong>{step.label}</strong>
              <em>
                {step.status === 'running'
                  ? step.id === 'live'
                    ? 'Connecting...'
                    : 'Working...'
                  : step.message ?? step.caption}
              </em>
            </span>
          </li>
        ))}
      </ol>

      {failed ? (
        <div className="fb-error-card">
          <div className="fb-error-head">
            <Icon name="warning" size={18} strokeWidth={2.4} />
            <strong>
              {failed.id === 'compile'
                ? 'Compile failed'
                : failed.id === 'upload'
                  ? 'Upload failed'
                  : failed.id === 'live'
                    ? 'Arduino disconnected'
                    : 'Validation failed'}
            </strong>
          </div>
          <p>{failed.message ?? 'Something interrupted the upload.'}</p>
          {failed.details ? <details><summary>Technical details</summary><pre>{failed.details}</pre></details> : null}
          <div className="fb-error-actions">
            <button type="button" className="fb-button fb-button--primary" onClick={onRetry}>
              Try again
            </button>
            <button type="button" className="fb-button fb-button--ghost" onClick={onBack}>
              Back to code
            </button>
          </div>
        </div>
      ) : null}

      {running ? (
        <button type="button" className="fb-button fb-button--ghost" onClick={onCancel}>
          Cancel
        </button>
      ) : null}
    </div>
  );
}
