import { useEffect, useMemo, useState } from 'react';
import { getComponent } from '@ardudeck/core';
import type { IrAction, IrRead } from '@ardudeck/core';
import { ApiError, api } from '../../services/api';
import { go, navigation } from '../../state/navigation';
import { getCompiled, project as projectStore } from '../../state/project';
import { useStore } from '../../state/store';
import { applyRuntime, clearTelemetry, telemetry } from '../../state/telemetry';
import { hardware as hardwareStore } from '../../state/hardware';
import { showToast } from '../../state/toast';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Pill } from '../../ui/Pill';
import { TopBar } from '../../ui/TopBar';

const OPERATOR: Record<string, string> = { lt: '<', gt: '>', eq: '=' };

function actionText(action: IrAction): string {
  switch (action.op) {
    case 'digitalWrite':
      return action.value === 1 ? 'ON' : 'OFF';
    case 'pwmWrite':
      return `${action.value}`;
    case 'servoWrite':
      return `${action.angle}°`;
    case 'tone':
      return `${action.frequency} Hz`;
    case 'stopTone':
      return 'silent';
    default:
      return '';
  }
}

export function TestLiveScreen() {
  const flow = useStore(projectStore, (state) => state.flow);
  const compiled = getCompiled(flow);
  const running = useStore(telemetry, (state) => state.running);
  const mode = useStore(telemetry, (state) => state.mode);
  const simulatedMode = useStore(hardwareStore, (state) => state.simulated);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const program = compiled.program;

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (!program) return;
      setStarting(true);
      setError(null);
      if (navigation.get().testSimulate) {
        try {
          const payload = await api.runtimeStart(program, true);
          if (!cancelled) applyRuntime(payload.runtime);
        } catch (caught) {
          if (!cancelled) setError(caught instanceof ApiError ? caught : null);
        } finally {
          if (!cancelled) setStarting(false);
        }
        return;
      }
      try {
        const payload = await api.runtimeStart(program, false);
        if (!cancelled) applyRuntime(payload.runtime);
      } catch (caught) {
        const apiError = caught instanceof ApiError ? caught : null;
        const canSimulate =
          apiError !== null &&
          ['no-hardware', 'not-ready', 'needs-bridge', 'hardware'].includes(apiError.code);
        if (!canSimulate) {
          if (!cancelled) setError(apiError);
        } else {
          try {
            const fallback = await api.runtimeStart(program, true);
            if (!cancelled) {
              applyRuntime(fallback.runtime);
              showToast('No Arduino connected: running in simulation.', 'warn');
            }
          } catch (fallbackError) {
            if (!cancelled) {
              setError(fallbackError instanceof ApiError ? fallbackError : null);
            }
          }
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    void start();
    return () => {
      cancelled = true;
      void api.runtimeStop().catch(() => undefined);
      clearTelemetry();
    };
  }, [program]);

  const readsByVar = useMemo(() => {
    const map = new Map<string, IrRead>();
    for (const read of program?.reads ?? []) map.set(read.var, read);
    return map;
  }, [program]);

  const values = useStore(telemetry, (state) => state.values);
  const rules = useStore(telemetry, (state) => state.rules);
  const outputs = useStore(telemetry, (state) => state.outputs);

  const stop = async () => {
    try {
      await api.runtimeStop();
    } catch {
      // Leaving the screen is more important than a clean stop.
    }
    clearTelemetry();
    go('flow');
  };

  if (!compiled.ok || !program) {
    return (
      <>
        <TopBar title="Test Live" onBack={() => go('flow')} />
        <div className="screen-body">
          <div className="empty-state">
            <Icon name="warning" size={34} />
            <div className="empty-title">{compiled.validation.summary}</div>
            <div>Fix the highlighted block in the flow.</div>
            <Button variant="primary" onClick={() => go('flow')}>
              BACK TO FLOW
            </Button>
          </div>
        </div>
      </>
    );
  }

  const simulateControls = mode === 'simulated';

  return (
    <>
      <TopBar
        title="Test Live"
        subtitle="Ardu OS is helping run this system"
        onBack={() => void stop()}
      >
        {mode === 'simulated' ? (
          <Pill tone="sim">
            <Icon name="flask" size={15} />
            SIMULATED
          </Pill>
        ) : (
          <Pill tone="ok">
            <span className="dot" />
            LIVE HARDWARE
          </Pill>
        )}
        <Button variant="danger" icon="stop" onClick={() => void stop()}>
          STOP
        </Button>
      </TopBar>

      <div className="screen-body screen-body--scroll">
        <div className="testlive">
          {!starting && !error ? <h1 className="test-heading">The system is running</h1> : null}

          {starting ? (
            <div className="note note--info">
              <span className="boot-spinner" />
              <span>Starting the flow...</span>
            </div>
          ) : null}

          {error ? (
            <div className="note note--danger">
              <Icon name="warning" size={18} />
              <span>
                {error.message}
                {error.hint ? ` ${error.hint}` : ''}
              </span>
            </div>
          ) : null}

          {simulateControls ? (
            <div className="test-sim">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <Icon name="flask" size={17} />
                SIMULATED - these values are not real
              </div>
              {program.reads.map((read) => {
                const entry = values[read.id];
                const value = entry?.value ?? null;
                return (
                  <div key={read.id} className="test-sim-row">
                    <span className="test-sim-label">{read.name}</span>
                    {read.kind === 'digital' ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (read.pin) void api.mockValue(read.pin, 1).catch(() => undefined);
                          }}
                        >
                          Press
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (read.pin) void api.mockValue(read.pin, 0).catch(() => undefined);
                          }}
                        >
                          Release
                        </Button>
                      </>
                    ) : (
                      <input
                        className="slider"
                        type="range"
                        min={0}
                        max={read.kind === 'distance' ? 200 : 1023}
                        step={read.kind === 'distance' ? 1 : 5}
                        value={value ?? 0}
                        onChange={(event) => {
                          const pin = read.kind === 'distance' ? read.trigPin : read.pin;
                          if (pin) void api.mockValue(pin, Number(event.target.value)).catch(() => undefined);
                        }}
                      />
                    )}
                    <span className="test-sim-value">
                      {value === null ? '––' : Math.round(value)}
                      {read.kind === 'distance' ? ' cm' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          {program.rules.map((rule) => {
            const read = readsByVar.get(rule.var);
            if (!read) {
              return (
                <div key={rule.id} className="test-rule">
                  <div className="test-card">
                    <div className="test-card-main">
                      <span className="test-label">Always</span>
                      <span className="test-detail">runs on every loop</span>
                    </div>
                  </div>

                  <div className="test-arrow">
                    <Icon name="chevron-down" size={22} />
                  </div>

                  <div className="test-card test-card--on">
                    <div className="test-card-main">
                      <span className="test-label">Rule</span>
                      <span className="test-value">Always</span>
                    </div>
                    <span className="node-badge node-badge--true">TRUE</span>
                  </div>

                  <div className="test-arrow">
                    <Icon name="chevron-down" size={22} />
                  </div>

                  <div className="test-card test-card--on">
                    <div className="test-card-main">
                      <span className="test-label">Action</span>
                      <span className="test-value">
                        {rule.then.map((action, index) => (
                          <span
                            key={`${action.nodeId}:${action.op}:${index}`}
                            style={{ marginRight: 12 }}
                          >
                            {action.name}{' '}
                            <span className="test-detail">
                              {outputs[action.nodeId]?.state ?? actionText(action)}
                            </span>
                          </span>
                        ))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }
            const def = getComponent(
              flow.nodes.find((node) => node.id === read.id)?.componentId ?? 'ldr',
            );
            const entry = values[read.id];
            const truth = rules[rule.id] ?? false;
            const actuators: IrAction[] = [];
            const seen = new Set<string>();
            for (const action of [...rule.then, ...rule.else]) {
              if (seen.has(action.nodeId)) continue;
              seen.add(action.nodeId);
              actuators.push(action);
            }
            return (
              <div key={rule.id} className="test-rule">
                <div className="test-card">
                  <div className="test-card-main">
                    <span className="test-label">{def?.name ?? read.name}</span>
                    <span className="test-value">
                      {entry?.value === undefined || entry.value === null
                        ? '––'
                        : Math.round(entry.value)}
                    </span>
                    <span className="test-detail">
                      {read.kind === 'distance' ? 'cm' : ''}
                      {entry && !entry.ok ? ' no reading' : ''}
                    </span>
                  </div>
                  <span className="node-pin">
                    {read.kind === 'distance'
                      ? `${read.trigPin ?? '?'} / ${read.echoPin ?? '?'}`
                      : read.pin ?? '?'}
                  </span>
                </div>

                <div className="test-arrow">
                  <Icon name="chevron-down" size={22} />
                </div>

                <div className={`test-card ${truth ? 'test-card--on' : 'test-card--idle'}`}>
                  <div className="test-card-main">
                    <span className="test-label">Rule</span>
                    <span className="test-value">
                      {OPERATOR[rule.condition.op] ?? '?'} {rule.condition.value}
                    </span>
                  </div>
                  <span className={`node-badge ${truth ? 'node-badge--true' : 'node-badge--false'}`}>
                    {truth ? 'TRUE' : 'FALSE'}
                  </span>
                </div>

                <div className="test-arrow">
                  <Icon name="chevron-down" size={22} />
                </div>

                <div className={`test-card ${truth ? 'test-card--on' : 'test-card--idle'}`}>
                  <div className="test-card-main">
                    <span className="test-label">Action</span>
                    <span className="test-value">
                      {actuators.map((action) => (
                        <span key={action.nodeId} style={{ marginRight: 12 }}>
                          {action.name}{' '}
                          <span className="test-detail">
                            {outputs[action.nodeId]?.state ?? actionText(action)}
                          </span>
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {running && !starting ? (
            <div className="hint">
              Change the rule in the flow, come back and try again.
              {' '}
              {simulatedMode ? '' : 'The Arduino reacts within a fraction of a second.'}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
