import { useEffect, useMemo, useState } from 'react';
import { go } from '../../state/navigation';
import { describeHardware, hardware as hardwareStore } from '../../state/hardware';
import { useStore } from '../../state/store';
import { ArduOsLogo } from '../../ui/Brand';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';

type CheckStatus = 'pending' | 'running' | 'ok' | 'note';

interface CheckLine {
  key: string;
  label: string;
  status: CheckStatus;
}

export function BootScreen() {
  const loaded = useStore(hardwareStore, (state) => state.loaded);
  const status = useStore(hardwareStore, (state) => state.hardware);
  const simulated = useStore(hardwareStore, (state) => state.simulated);
  const [interfaceReady, setInterfaceReady] = useState(false);
  const [waitedTooLong, setWaitedTooLong] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setInterfaceReady(true), 180);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loaded) return undefined;
    const timer = window.setTimeout(() => setWaitedTooLong(true), 5000);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  const checks = useMemo<CheckLine[]>(() => {
    const hardwareCheck: CheckLine = loaded
      ? {
          key: 'hardware',
          status: status.state === 'ready' ? 'ok' : 'note',
          label:
            status.state === 'ready'
              ? describeHardware(status, simulated).label
              : 'No Arduino connected',
        }
      : { key: 'hardware', status: 'running', label: 'Shared hardware service' };
    return [
      { key: 'interface', label: 'Ardu OS interface', status: interfaceReady ? 'ok' : 'running' },
      { key: 'engine', label: 'Arduino engine', status: loaded ? 'ok' : 'running' },
      hardwareCheck,
    ];
  }, [interfaceReady, loaded, status, simulated]);

  useEffect(() => {
    if (!loaded) return undefined;
    const timer = window.setTimeout(() => go('os'), 700);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  return (
    <div className="boot">
      <div className="boot-brand">
        <ArduOsLogo size={72} />
        <div className="boot-name">Ardu OS</div>
        <div className="boot-tag">Make real things.</div>
      </div>

      <div className="boot-checks">
        {checks.map((check) => (
          <div
            key={check.key}
            className={`boot-check ${check.status === 'ok' ? 'boot-check--ok' : ''}`}
          >
            <span className="boot-check-icon">
              {check.status === 'ok' ? (
                <Icon name="check" size={16} strokeWidth={3} />
              ) : (
                <span className="boot-spinner" />
              )}
            </span>
            {check.label}
          </div>
        ))}
      </div>

      {waitedTooLong && !loaded ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div className="hint">Ardu OS is still starting up.</div>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
