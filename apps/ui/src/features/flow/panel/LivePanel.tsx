import { useEffect, useMemo, useRef, useState } from 'react';
import type { CompileResult, IrProgram } from '@ardudeck/core';
import { getComponent } from '@ardudeck/core';
import { api } from '../../../services/api';
import { deploy as deployStore } from '../../../state/deploy';
import { hardware as hardwareStore, refreshHardware } from '../../../state/hardware';
import type { Flow } from '@ardudeck/core';
import { telemetry } from '../../../state/telemetry';
import { useStore } from '../../../state/store';
import { showError, showToast } from '../../../state/toast';
import { Icon } from '../../../ui/Icon';

const OPERATOR: Record<string, string> = {
  lt: '<',
  gt: '>',
  eq: '=',
  lte: '≤',
  gte: '≥',
  neq: '≠',
};

function shortUnit(unit: string | undefined): string {
  return unit ?? '';
}

function Pipeline() {
  const live = useStore(deployStore, (state) => state.live);
  const stages = ['Validate', 'Compile', 'Upload', 'Live Mode'];
  return (
    <div className="fb-pipeline">
      {stages.map((stage, index) => {
        const active = stage === 'Live Mode' ? live === 'streaming' : true;
        const running = stage === 'Live Mode' && live === 'starting';
        return (
          <div key={stage} className="fb-pipeline-stage">
            <span className={`fb-pipeline-mark ${active ? 'is-ok' : ''} ${running ? 'is-running' : ''}`}>
              {active ? <Icon name="check" size={14} strokeWidth={3} /> : index + 1}
            </span>
            <span className="fb-pipeline-copy">
              <strong>{stage}</strong>
              <em>{active ? (stage === 'Live Mode' ? 'Active' : 'Success') : running ? 'Starting' : 'Waiting'}</em>
            </span>
            {index < stages.length - 1 ? <span className="fb-pipeline-line" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function BoardStatus() {
  const status = useStore(hardwareStore, (state) => state.hardware);
  const simulated = useStore(hardwareStore, (state) => state.simulated);
  const board = simulated ? 'Simulated board' : (status.board ?? 'Arduino');
  const port = simulated ? 'Simulation' : (status.port ?? '—');
  const connected = status.state === 'ready' || status.state === 'deployed' || simulated;
  return (
    <section className="fb-section-card">
      <h3>Board Status</h3>
      <div className="fb-board-grid">
        <div className="fb-board-card">
          <span className="fb-board-icon">
            <Icon name="chip" size={20} strokeWidth={2} />
          </span>
          <span>
            <strong>{board}</strong>
            <em>{connected ? 'Detected and ready' : 'Not connected'}</em>
          </span>
        </div>
        <div className="fb-board-card">
          <span className="fb-board-icon">
            <Icon name="usb" size={20} strokeWidth={2} />
          </span>
          <span>
            <strong>{port}</strong>
            <em>{connected ? 'Connected' : 'Waiting'}</em>
          </span>
        </div>
      </div>
    </section>
  );
}

function Sparkline({ samples, min, max }: { samples: number[]; min: number; max: number }) {
  const width = 120;
  const height = 28;
  if (samples.length < 2) return <svg className="fb-spark" viewBox={`0 0 ${width} ${height}`} />;
  const span = Math.max(1, max - min);
  const step = width / (samples.length - 1);
  const points = samples
    .map((value, index) => {
      const ratio = Math.max(0, Math.min(1, (value - min) / span));
      return `${(index * step).toFixed(1)},${(height - 3 - ratio * (height - 6)).toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg className="fb-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke="#8fd0f5" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function ValueCard({
  id,
  title,
  subtitle,
  unit,
  min,
  max,
  stale,
}: {
  id: string;
  title: string;
  subtitle: string;
  unit: string;
  min: number;
  max: number;
  stale: boolean;
}) {
  const value = useStore(telemetry, (state) => state.values[id]?.value ?? null);
  const samples = useRef<number[]>([]);
  const last = useRef(0);
  const [, force] = useState(0);

  useEffect(() => {
    if (value === null || !Number.isFinite(value)) return;
    const now = Date.now();
    if (now - last.current < 120) return;
    last.current = now;
    samples.current = [...samples.current.slice(-39), value];
    force((tick) => tick + 1);
  }, [value]);

  return (
    <article className={`fb-metric ${stale ? 'is-stale' : ''}`}>
      <header>
        <span>
          <strong>{title}</strong>
          <em>{subtitle}</em>
        </span>
      </header>
      <div className="fb-metric-row">
        <span className="fb-metric-value">
          {value === null ? '––' : Math.round(value)}
          {unit ? <small>{shortUnit(unit)}</small> : null}
        </span>
        <Sparkline samples={samples.current} min={min} max={max} />
      </div>
    </article>
  );
}

function ConditionCard({
  id,
  expression,
  stale,
}: {
  id: string;
  expression: string;
  stale: boolean;
}) {
  const truth = useStore(telemetry, (state) => state.rules[id] ?? false);
  const running = useStore(telemetry, (state) => state.running);
  return (
    <article className={`fb-metric ${stale ? 'is-stale' : ''}`}>
      <header>
        <span>
          <strong>Condition</strong>
          <em>Rule</em>
        </span>
      </header>
      <span className={`fb-metric-truth ${running && truth ? 'is-true' : ''}`}>
        {running ? (truth ? 'TRUE' : 'FALSE') : '––'}
      </span>
      <span className="fb-metric-expression">{expression}</span>
    </article>
  );
}

function OutputCard({
  id,
  title,
  subtitle,
  stale,
}: {
  id: string;
  title: string;
  subtitle: string;
  stale: boolean;
}) {
  const state = useStore(telemetry, (state) => state.outputs[id]?.state ?? null);
  const on = state !== null && state !== 'OFF' && state !== 'silent' && state !== '0';
  return (
    <article className={`fb-metric ${stale ? 'is-stale' : ''}`}>
      <header>
        <span>
          <strong>{title}</strong>
          <em>{subtitle}</em>
        </span>
      </header>
      <span className={`fb-metric-value ${on ? 'is-on' : ''}`}>{state ?? '––'}</span>
      <span className="fb-metric-expression">{on ? 'Output ON' : 'Output OFF'}</span>
    </article>
  );
}

function SerialLog({ program, running }: { program: IrProgram | null; running: boolean }) {
  const values = useStore(telemetry, (state) => state.values);
  const outputs = useStore(telemetry, (state) => state.outputs);
  const [entries, setEntries] = useState<string[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const box = useRef<HTMLDivElement | null>(null);
  const lastSample = useRef(0);

  useEffect(() => {
    if (!program || !running) return;
    const now = Date.now();
    if (now - lastSample.current < 1000) return;
    lastSample.current = now;
    const parts = program.reads.map((read) => {
      const entry = values[read.id];
      const value = entry?.value;
      return `${read.name}: ${value === undefined || value === null ? '--' : Math.round(value)}`;
    });
    const seen = new Set<string>();
    for (const rule of program.rules) {
      for (const action of [...rule.then, ...rule.else]) {
        if (seen.has(action.nodeId)) continue;
        seen.add(action.nodeId);
        parts.push(`${action.name}: ${outputs[action.nodeId]?.state ?? '--'}`);
      }
    }
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setEntries((current) => [...current.slice(-59), `${time}  ${parts.join(' | ')}`]);
  }, [program, running, values, outputs]);

  useEffect(() => {
    if (autoScroll && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [entries, autoScroll]);

  return (
    <section className="fb-section-card">
      <div className="fb-serial-head">
        <h3>Live Serial Log</h3>
        <label className="fb-switch">
          <span>Auto-scroll</span>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(event) => setAutoScroll(event.target.checked)}
          />
          <span className="fb-switch-track" aria-hidden="true" />
        </label>
        <button
          type="button"
          className="fb-icon-button"
          aria-label="Clear log"
          onClick={() => setEntries([])}
        >
          <Icon name="trash" size={16} strokeWidth={2} />
        </button>
      </div>
      <div className="fb-serial" ref={box}>
        {entries.length === 0 ? (
          <p className="fb-serial-empty">Waiting for readings...</p>
        ) : (
          entries.map((entry, index) => <div key={index}>{entry}</div>)
        )}
      </div>
    </section>
  );
}

export function LivePanel({
  flow,
  compiled,
  changedSinceDeploy,
  onViewCode,
  onReupload,
  onStopLive,
}: {
  flow: Flow;
  compiled: CompileResult;
  changedSinceDeploy: boolean;
  onViewCode: () => void;
  onReupload: () => void;
  onStopLive: () => void;
}) {
  const live = useStore(deployStore, (state) => state.live);
  const message = useStore(deployStore, (state) => state.message);
  const status = useStore(hardwareStore, (state) => state.hardware);
  const program = compiled.program;
  const stale = live === 'paused' || live === 'disconnected';

  const ruleCards = useMemo(() => {
    if (!program) return [];
    return program.rules.map((rule) => {
      const read = program.reads.find((candidate) => candidate.var === rule.var);
      const expression = `${read?.name ?? rule.var} ${
        OPERATOR[rule.condition.op] ?? '?'
      } ${rule.condition.value}`;
      return { id: rule.id, expression };
    });
  }, [program]);

  const outputCards = useMemo(() => {
    if (!program) return [];
    const seen = new Set<string>();
    const cards: { id: string; title: string; subtitle: string }[] = [];
    for (const rule of program.rules) {
      for (const action of [...rule.then, ...rule.else]) {
        if (seen.has(action.nodeId)) continue;
        seen.add(action.nodeId);
        const node = flow.nodes.find((candidate) => candidate.id === action.nodeId);
        const def = node ? getComponent(node.componentId) : undefined;
        cards.push({
          id: action.nodeId,
          title: action.pin ? `${action.name} (${action.pin})` : action.name,
          subtitle: def?.category === 'actuator' ? 'Actuator' : 'Output',
        });
      }
    }
    return cards;
  }, [program, flow.nodes]);

  return (
    <div className="fb-panel-body fb-panel-body--live">
      <div className="fb-success">
        <span className="fb-success-icon">
          <Icon name="check" size={22} strokeWidth={3} />
        </span>
        <span>
          <strong>Uploaded Successfully!</strong>
          <em>Program running on {status.board ?? 'Arduino'}{status.port ? ` · ${status.port}` : ''}.</em>
        </span>
      </div>

      <Pipeline />

      {changedSinceDeploy ? (
        <div className="fb-banner fb-banner--warn">
          <span>Changes not deployed. The Arduino is still running the previous program.</span>
        </div>
      ) : null}

      {stale ? (
        <div className="fb-banner fb-banner--error">
          <span>{message ?? 'Arduino disconnected. Live values are paused.'}</span>
          <button
            type="button"
            onClick={() => {
              void api
                .reconnectHardware()
                .then(() => refreshHardware())
                .then(() => showToast('Looking for the Arduino...'))
                .catch(showError);
            }}
          >
            Reconnect
          </button>
        </div>
      ) : null}

      <BoardStatus />

      <section className="fb-section-card">
        <div className="fb-section-title-row">
          <h3>Live Sensor Data</h3>
          <span className={`fb-live-badge ${live === 'streaming' ? 'is-live' : ''}`}>
            ● {live === 'streaming' ? 'Live' : live === 'starting' ? 'Starting' : 'Paused'}
          </span>
        </div>
        <div className="fb-metrics">
          {program?.reads.map((read) => {
            const node = flow.nodes.find((candidate) => candidate.id === read.id);
            const def = node ? getComponent(node.componentId) : undefined;
            return (
              <ValueCard
                key={read.id}
                id={read.id}
                title={read.name}
                subtitle={read.pin ?? (read.kind === 'distance' ? 'Distance' : '')}
                unit={def?.reading?.unit ?? ''}
                min={def?.reading?.min ?? 0}
                max={def?.reading?.max ?? 1023}
                stale={stale}
              />
            );
          })}
          {ruleCards.map((rule) => (
            <ConditionCard key={rule.id} id={rule.id} expression={rule.expression} stale={stale} />
          ))}
          {outputCards.map((card) => (
            <OutputCard
              key={card.id}
              id={card.id}
              title={card.title}
              subtitle={card.subtitle}
              stale={stale}
            />
          ))}
        </div>
      </section>

      <SerialLog program={program ?? null} running={live === 'streaming' || live === 'paused'} />

      <div className="fb-live-controls">
        <button type="button" className="fb-button fb-button--ghost" onClick={onViewCode}>
          <Icon name="code" size={17} strokeWidth={2.2} />
          View Code
        </button>
        <button
          type="button"
          className={`fb-button ${changedSinceDeploy ? 'fb-button--reupload is-hot' : 'fb-button--reupload'}`}
          onClick={onReupload}
        >
          <Icon name="refresh" size={17} strokeWidth={2.4} />
          Re-upload
        </button>
        <button type="button" className="fb-button fb-button--stop" onClick={onStopLive}>
          <Icon name="stop" size={17} strokeWidth={2.2} />
          Stop Live
        </button>
      </div>
    </div>
  );
}
