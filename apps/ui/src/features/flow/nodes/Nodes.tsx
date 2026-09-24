import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ComponentDef, ControlBlock, FlowNode, PinId } from '@ardudeck/core';
import { createBlock, pinsForKinds } from '@ardudeck/core';
import {
  deleteNode,
  disconnectNode,
  duplicateNode,
  setConditionOperator,
  setNodeConfig,
} from '../../../state/flowOps';
import { project as projectStore } from '../../../state/project';
import { telemetry } from '../../../state/telemetry';
import { useStore } from '../../../state/store';
import { showToast } from '../../../state/toast';
import { Icon } from '../../../ui/Icon';
import type { IconName } from '../../../ui/Icon';
import type { ArdudeckNode, ArdudeckNodeData, PlaceholderNode as PlaceholderNodeType } from '../nodeData';
import { accentFor } from '../nodeData';

const ICONS: Record<string, IconName> = {
  sun: 'sun',
  knob: 'knob',
  button: 'button',
  wave: 'wave',
  led: 'led',
  rgb: 'rgb',
  buzzer: 'buzzer',
  servo: 'servo',
  motion: 'motion',
  switch: 'switch',
  less: 'less',
  greater: 'greater',
  equal: 'equal',
  thermometer: 'thermometer',
  droplet: 'droplet',
  rain: 'rain',
  water: 'water',
  hand: 'hand',
  infrared: 'infrared',
  sound: 'sound',
  soil: 'soil',
  relay: 'relay',
  timer: 'timer',
  motor: 'motor',
};

const OPERATORS: { id: string; symbol: string; label: string }[] = [
  { id: 'lessThan', symbol: '<', label: 'less than' },
  { id: 'greaterThan', symbol: '>', label: 'greater than' },
  { id: 'equalsTo', symbol: '=', label: 'equal to' },
  { id: 'lessThanOrEqual', symbol: '≤', label: 'less than or equal' },
  { id: 'greaterThanOrEqual', symbol: '≥', label: 'greater than or equal' },
  { id: 'notEquals', symbol: '≠', label: 'not equal' },
];

function nodePins(node: FlowNode, def: ComponentDef) {
  return def.pins.map((spec) => ({ spec, pin: node.config.pins[spec.id] }));
}

function updatePins(node: FlowNode, key: string, pin: PinId) {
  setNodeConfig(node.id, {
    ...node.config,
    pins: { ...node.config.pins, [key]: pin },
  });
}

function updateFields(node: FlowNode, fields: Record<string, number | string | boolean>) {
  setNodeConfig(node.id, { ...node.config, fields: { ...node.config.fields, ...fields } });
}

/* ------------------------------------------------------------ pin badges -- */

function PinBadge({
  label,
  tone,
  onClick,
  empty,
  title,
}: {
  label: string;
  tone: 'signal' | 'power' | 'ground';
  onClick?: () => void;
  empty?: boolean;
  title?: string;
}) {
  const className = `fb-pin fb-pin--${tone} ${empty ? 'fb-pin--empty' : ''} ${
    onClick ? 'fb-pin--button' : ''
  }`;
  if (!onClick) {
    return (
      <span className={className} title={title}>
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`${className} nodrag`}
      onClick={onClick}
      title={title ?? `Choose a pin for ${label}`}
    >
      {label}
    </button>
  );
}

function PinStrip({
  node,
  def,
  onChoose,
}: {
  node: FlowNode;
  def: ComponentDef;
  onChoose: (specId: string | null) => void;
}) {
  return (
    <div className="fb-pins">
      {nodePins(node, def).map(({ spec, pin }) => (
        <div key={spec.id} className="fb-pin-row">
          <span className="fb-pin-label">{spec.label}</span>
          <PinBadge
            label={pin ?? 'choose'}
            tone="signal"
            empty={!pin}
            onClick={() => onChoose(spec.id)}
            title={pin ? `Change the pin for ${spec.label}` : `Choose a pin for ${spec.label}`}
          />
        </div>
      ))}
      {(def.wiring ?? []).map((wire) => (
        <PinBadge key={wire.label} label={wire.label} tone={wire.role} />
      ))}
    </div>
  );
}

function PinPopover({
  node,
  def,
  specId,
  onClose,
}: {
  node: FlowNode;
  def: ComponentDef;
  specId: string;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fb-popover-backdrop nodrag" onClick={onClose} />
      <div className="fb-popover nodrag">
        <PinChooser node={node} def={def} specId={specId} onPick={onClose} />
      </div>
    </>
  );
}

function PinChooser({
  node,
  def,
  specId,
  onPick,
}: {
  node: FlowNode;
  def: ComponentDef;
  specId: string;
  onPick?: () => void;
}) {
  const spec = def.pins.find((candidate) => candidate.id === specId);
  if (!spec) return null;
  // Every pin stays available so students can freely rewire true/false paths.
  const pins = pinsForKinds(spec.kinds);
  return (
    <div className="fb-pin-chooser">
      <div className="fb-menu-label">
        {def.pins.length > 1 ? `Pin ${spec.label}` : 'Pin'}
      </div>
      <div className="fb-popover-grid">
        {pins.map((pin) => (
          <button
            key={pin}
            type="button"
            className={`fb-pin-choice ${node.config.pins[spec.id] === pin ? 'fb-pin-choice--active' : ''}`}
            onClick={() => {
              updatePins(node, spec.id, pin);
              onPick?.();
            }}
          >
            {pin}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- inline -- */

function InlineNumber({
  value,
  min,
  max,
  step,
  unit,
  size = 'default',
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  size?: 'default' | 'chip';
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = Math.max(min, Math.min(max, Math.round(parsed)));
    setDraft(String(next));
    if (next !== value) onChange(next);
  };
  return (
    <div className={`fb-number nodrag ${size === 'chip' ? 'fb-number--chip' : ''}`}>
      <input
        className="fb-number-input"
        inputMode="numeric"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit((event.target as HTMLInputElement).value);
        }}
        aria-label="Value"
      />
      {unit ? <span className="fb-number-unit">{unit}</span> : null}
      <span className="fb-number-steps">
        <button
          type="button"
          aria-label="Increase"
          onClick={() => commit(String(value + step))}
        >
          <Icon name="chevron-up" size={14} strokeWidth={2.6} />
        </button>
        <button
          type="button"
          aria-label="Decrease"
          onClick={() => commit(String(value - step))}
        >
          <Icon name="chevron-down" size={14} strokeWidth={2.6} />
        </button>
      </span>
    </div>
  );
}

function MoreMenu({
  node,
  def,
  onClose,
}: {
  node: FlowNode;
  def: ComponentDef;
  onClose: () => void;
}) {
  const flow = useStore(projectStore, (state) => state.flow);
  const connected = flow.edges.some(
    (edge) => edge.source === node.id || edge.target === node.id,
  );
  const hasBlocks = (node.config.blocks ?? []).length > 0;
  // With control blocks in place, the old single-command settings are gone;
  // only the rest values still matter (the relay load stays on the card).
  const KEPT_WITH_BLOCKS = new Set(['restAngle', 'restSpeed']);
  const settings = hasBlocks
    ? def.fields.filter((field) => KEPT_WITH_BLOCKS.has(field.id))
    : def.fields;

  return (
    <>
      <div className="fb-popover-backdrop nodrag" onClick={onClose} />
      <div className="fb-popover fb-popover--menu nodrag nowheel">
        <div className="fb-menu-head">
          <div className="fb-popover-title">{def.name}</div>
          <button
            type="button"
            className="fb-menu-close"
            aria-label="Close card options"
            title="Close"
            onClick={onClose}
          >
            <Icon name="close" size={15} strokeWidth={2.4} />
          </button>
        </div>
        <p className="fb-menu-summary">{def.summary}</p>

        {def.pins.length > 0 ? (
          <div className="fb-menu-block">
            {def.pins.map((spec) => (
              <PinChooser key={spec.id} node={node} def={def} specId={spec.id} />
            ))}
          </div>
        ) : null}

        {def.wiring && def.wiring.length > 0 ? (
          <p className="fb-menu-wiring">
            Also wire: {def.wiring.map((wire) => wire.label).join(' · ')}
          </p>
        ) : null}

        {settings.length > 0 ? (
          <div className="fb-menu-block">
            <div className="fb-menu-label">Settings</div>
            {settings.map((field) => {
              if (field.type === 'select') {
                return (
                  <label key={field.id} className="fb-menu-field">
                    <span>{field.label}</span>
                    <select
                      className="fb-select nodrag"
                      value={String(node.config.fields[field.id] ?? field.defaultValue)}
                      onChange={(event) => updateFields(node, { [field.id]: event.target.value })}
                    >
                      {field.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }
              if (field.type === 'number') {
                return (
                  <label key={field.id} className="fb-menu-field">
                    <span>{field.label}</span>
                    <InlineNumber
                      value={Number(node.config.fields[field.id] ?? field.defaultValue)}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      unit={field.unit}
                      onChange={(next) => updateFields(node, { [field.id]: next })}
                    />
                  </label>
                );
              }
              return null;
            })}
          </div>
        ) : null}

        {def.safety ? <p className="fb-menu-note">{def.safety}</p> : null}

        <div className="fb-menu-actions">
          <button
            type="button"
            onClick={() => {
              const copy = duplicateNode(node.id);
              onClose();
              if (copy) showToast(`${def.name} duplicated.`);
            }}
          >
            <Icon name="copy" size={15} strokeWidth={2} />
            Duplicate
          </button>
          {connected ? (
            <button
              type="button"
              onClick={() => {
                disconnectNode(node.id);
                onClose();
                showToast('Connections removed. The card is still here.');
              }}
            >
              <Icon name="external" size={15} strokeWidth={2} />
              Disconnect
            </button>
          ) : null}
          <button
            type="button"
            className="is-danger"
            onClick={() => {
              deleteNode(node.id);
              showToast(`${def.name} removed. Undo brings it back.`);
            }}
          >
            <Icon name="trash" size={15} strokeWidth={2} />
            Remove card
          </button>
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------- node shell */

function NodeFrame({
  data,
  selected,
  className,
  children,
}: {
  data: ArdudeckNodeData;
  selected: boolean;
  className: string;
  children: ReactNode;
}) {
  const { node, def, errors } = data;
  const accent = accentFor(def);
  const classes = [
    'fb-node',
    className,
    selected ? 'fb-node--selected' : '',
    errors.length > 0 ? 'fb-node--invalid' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} style={{ ['--node-accent' as string]: accent }}>
      {children}
      {errors.length > 0 ? <div className="fb-node-error">{errors[0]}</div> : null}
      <span className="fb-node-id" data-id={node.id} />
    </div>
  );
}

function IconColumn({
  def,
  menuOpen,
  onMenu,
}: {
  def: ComponentDef;
  menuOpen: boolean;
  onMenu: () => void;
}) {
  return (
    <div className="fb-node-icon-col">
      <span className="fb-node-icon">
        <Icon name={ICONS[def.icon] ?? 'sun'} size={22} strokeWidth={2.2} />
      </span>
      <button
        type="button"
        className={`fb-node-menu nodrag ${menuOpen ? 'is-open' : ''}`}
        aria-label="Card options"
        aria-expanded={menuOpen}
        onClick={onMenu}
      >
        ⋯
      </button>
    </div>
  );
}

/* -------------------------------------------------------------- sensor ---- */

export function SensorNode({ data, selected }: NodeProps<ArdudeckNode>) {
  const { node, def } = data;
  const [pinSpec, setPinSpec] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const running = useStore(telemetry, (state) => state.running);
  const value = useStore(telemetry, (state) => state.values[node.id]?.value ?? null);
  const reading = def.reading;
  const range = reading ? `(${reading.min} - ${reading.max})` : '';

  return (
    <NodeFrame data={data} selected={selected} className="fb-node--sensor">
      <IconColumn def={def} menuOpen={menu} onMenu={() => setMenu((open) => !open)} />
      <div className="fb-node-content">
        <span className="fb-node-title">{def.name}</span>
        <span className="fb-node-sub">
          {def.summary} {range}
        </span>
        {running && value !== null ? (
          <span className="fb-live-chip">{Math.round(value)}</span>
        ) : null}
      </div>
      <PinStrip node={node} def={def} onChoose={setPinSpec} />
      {pinSpec ? (
        <PinPopover node={node} def={def} specId={pinSpec} onClose={() => setPinSpec(null)} />
      ) : null}
      {menu ? <MoreMenu node={node} def={def} onClose={() => setMenu(false)} /> : null}
      <Handle type="source" position={Position.Bottom} className="fb-handle fb-handle--source" />
    </NodeFrame>
  );
}

/* ----------------------------------------------------------- condition ---- */

export function ConditionNode({ data, selected }: NodeProps<ArdudeckNode>) {
  const { node, def } = data;
  const [menu, setMenu] = useState(false);
  const running = useStore(telemetry, (state) => state.running);
  const truth = useStore(telemetry, (state) => state.rules[node.id] ?? false);
  const value = Number(node.config.fields['value'] ?? 300);
  const operator = OPERATORS.find((item) => item.id === node.componentId) ?? OPERATORS[0];

  return (
    <NodeFrame data={data} selected={selected} className="fb-node--condition">
      <IconColumn def={def} menuOpen={menu} onMenu={() => setMenu((open) => !open)} />
      <div className="fb-node-content">
        <span className="fb-node-title">Condition</span>
        <span className="fb-node-sub">{def.name}</span>
      </div>
      <div className="fb-condition-row nodrag">
        <span className="fb-condition-if">if value</span>
        <select
          className="fb-select fb-select--operator"
          value={operator?.id}
          title={operator?.label}
          onChange={(event) => setConditionOperator(node.id, event.target.value as never)}
          aria-label={`Comparison operator: ${operator?.label ?? ''}`}
        >
          {OPERATORS.map((item) => (
            <option key={item.id} value={item.id} title={item.label}>
              {item.symbol}
            </option>
          ))}
        </select>
        <InlineNumber
          value={value}
          min={0}
          max={1023}
          step={1}
          onChange={(next) => updateFields(node, { value: next })}
        />
      </div>
      {running ? (
        <span className={`fb-truth ${truth ? 'fb-truth--true' : 'fb-truth--false'}`}>
          {truth ? 'TRUE' : 'FALSE'}
        </span>
      ) : null}
      {menu ? <MoreMenu node={node} def={def} onClose={() => setMenu(false)} /> : null}
      <Handle type="target" position={Position.Top} className="fb-handle fb-handle--target" />
      <Handle
        type="source"
        position={Position.Left}
        id="false"
        className="fb-handle fb-handle--false"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="fb-handle fb-handle--true"
      />
      <span className="fb-branch fb-branch--false">False</span>
      <span className="fb-branch fb-branch--true">True</span>
    </NodeFrame>
  );
}

/* ------------------------------------------------------------ actuator ---- */

function toHexByte(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${toHexByte(red)}${toHexByte(green)}${toHexByte(blue)}`;
}

function hexToRgb(hex: string): { red: number; green: number; blue: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match || !match[1]) return null;
  const value = Number.parseInt(match[1], 16);
  return { red: (value >> 16) & 255, green: (value >> 8) & 255, blue: value & 255 };
}

/**
 * Colour family for a control block. On/off style commands are blue, waits are
 * yellow, value commands (angle/speed) are violet, colours are neutral.
 */
function blockTone(kind: string): 'action' | 'time' | 'value' | 'color' {
  if (kind === 'delay') return 'time';
  if (kind === 'angle' || kind === 'speed') return 'value';
  if (kind === 'color') return 'color';
  return 'action';
}

/** Colours the live output chip when the last action was an RGB write. */
function outputChipStyle(output: string): CSSProperties | undefined {
  const match = /^RGB (\d+),(\d+),(\d+)$/.exec(output);
  if (!match) return undefined;
  return {
    background: `rgb(${match[1]}, ${match[2]}, ${match[3]})`,
    color: '#14131a',
  };
}

/**
 * The control blocks area: stack HIGH, LOW, ANGLE, SPEED, DELAY, ... on the
 * card and they run in order whenever the card's branch is active.
 */
function ActuatorBlocks({ node, def }: { node: FlowNode; def: ComponentDef }) {
  const specs = def.blocks ?? [];
  const [adding, setAdding] = useState(false);
  if (specs.length === 0) return null;

  const blocks = node.config.blocks ?? [];
  const setBlocks = (next: ControlBlock[]) =>
    setNodeConfig(node.id, { ...node.config, blocks: next });
  const updateValues = (block: ControlBlock, values: Record<string, number>) =>
    setBlocks(
      blocks.map((candidate) =>
        candidate.id === block.id
          ? { ...candidate, values: { ...candidate.values, ...values } }
          : candidate,
      ),
    );

  return (
    <div className="fb-blocks-area">
      <div className="fb-blocks-head">
        <span className="fb-menu-label">Controls</span>
        <button
          type="button"
          className="fb-block-add nodrag"
          onClick={() => setAdding((open) => !open)}
          aria-expanded={adding}
        >
          <Icon name="plus" size={13} strokeWidth={2.6} />
          Add control
        </button>
      </div>

      {blocks.length === 0 ? (
        <p className="fb-blocks-empty">
          {def.requiresBlocks
            ? 'Add a control so this card can act.'
            : 'Add blocks to run a sequence instead of one command.'}
        </p>
      ) : (
        <div className="fb-block-chips">
          {blocks.map((block) => {
            const spec = specs.find((candidate) => candidate.kind === block.kind);
            if (!spec) return null;
            return (
              <div
                key={block.id}
                className={`fb-block-chip fb-block-chip--${blockTone(block.kind)} nodrag`}
              >
                <span className="fb-block-kind">{spec.text}</span>
                {spec.color ? (
                  <input
                    type="color"
                    className="fb-color-input"
                    value={rgbToHex(
                      block.values?.['red'] ?? 255,
                      block.values?.['green'] ?? 255,
                      block.values?.['blue'] ?? 255,
                    )}
                    onChange={(event) => {
                      const rgb = hexToRgb(event.target.value);
                      if (rgb) updateValues(block, rgb);
                    }}
                    aria-label={`${def.name} colour`}
                  />
                ) : null}
                {(spec.numbers ?? [])
                  .filter(() => !spec.color)
                  .map((number) => (
                    <InlineNumber
                      key={number.id}
                      value={block.values?.[number.id] ?? number.defaultValue}
                      min={number.min}
                      max={number.max}
                      step={number.step}
                      unit={number.unit}
                      size="chip"
                      onChange={(next) => updateValues(block, { [number.id]: next })}
                    />
                  ))}
                <button
                  type="button"
                  className="fb-block-remove"
                  aria-label={`Remove ${spec.label}`}
                  title="Remove"
                  onClick={() =>
                    setBlocks(blocks.filter((candidate) => candidate.id !== block.id))
                  }
                >
                  <Icon name="close" size={12} strokeWidth={2.6} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {adding ? (
        <>
          <div className="fb-popover-backdrop nodrag" onClick={() => setAdding(false)} />
          <div className="fb-popover fb-popover--blocks nodrag nowheel">
            <div className="fb-menu-head">
              <div className="fb-popover-title">Add a control</div>
              <button
                type="button"
                className="fb-menu-close"
                aria-label="Close add control"
                title="Close"
                onClick={() => setAdding(false)}
              >
                <Icon name="close" size={14} strokeWidth={2.4} />
              </button>
            </div>
            <div className="fb-block-options">
              {specs.map((spec) => (
                <button
                  key={spec.kind}
                  type="button"
                  className={`fb-block-option fb-block-option--${blockTone(spec.kind)}`}
                  onClick={() => {
                    setBlocks([...blocks, createBlock(spec)]);
                    setAdding(false);
                  }}
                >
                  {spec.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** The relay load is a setting, not a command: it stays on the card always. */
function RelayLoadSelect({ node, def }: { node: FlowNode; def: ComponentDef }) {
  const loadField = def.fields.find((field) => field.id === 'load');
  const loads = loadField && loadField.type === 'select' ? loadField.options : [];
  if (loads.length === 0) return null;
  return (
    <select
      className="fb-select fb-select--command nodrag"
      value={String(node.config.fields['load'] ?? 'fan')}
      onChange={(event) => updateFields(node, { load: event.target.value })}
      aria-label="Relay load"
    >
      {loads.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function ActuatorCommand({ node, def }: { node: FlowNode; def: ComponentDef }) {
  if (def.id === 'led') {
    const high = node.config.fields['whenTrue'] !== 'off';
    return (
      <select
        className="fb-select fb-select--command nodrag"
        value={high ? 'high' : 'low'}
        onChange={(event) =>
          updateFields(node, { whenTrue: event.target.value === 'high' ? 'on' : 'off' })
        }
        aria-label="LED command"
      >
        <option value="high">Turn LED HIGH</option>
        <option value="low">Turn LED LOW</option>
      </select>
    );
  }

  if (def.id === 'relay') {
    const on = node.config.fields['whenTrue'] !== 'off';
    return (
      <select
        className="fb-select fb-select--command nodrag"
        value={on ? 'on' : 'off'}
        onChange={(event) => updateFields(node, { whenTrue: event.target.value })}
        aria-label="Relay command"
      >
        <option value="on">Switch ON</option>
        <option value="off">Switch OFF</option>
      </select>
    );
  }

  if (def.id === 'buzzer') {
    return (
      <select
        className="fb-select fb-select--command nodrag"
        value={String(node.config.fields['whenTrue'] ?? 'beep')}
        onChange={(event) => updateFields(node, { whenTrue: event.target.value })}
        aria-label="Buzzer command"
      >
        <option value="beep">Play tone</option>
        <option value="silent">Stay silent</option>
      </select>
    );
  }

  if (def.id === 'servo') {
    return (
      <div className="fb-command-row nodrag">
        <span className="fb-command-label">Angle</span>
        <InlineNumber
          value={Number(node.config.fields['angle'] ?? 90)}
          min={0}
          max={180}
          step={5}
          unit="°"
          onChange={(next) => updateFields(node, { angle: next })}
        />
      </div>
    );
  }

  if (def.id === 'servo360') {
    return (
      <div className="fb-command-row nodrag">
        <span className="fb-command-label">Speed</span>
        <InlineNumber
          value={Number(node.config.fields['speedTrue'] ?? 120)}
          min={0}
          max={180}
          step={5}
          onChange={(next) => updateFields(node, { speedTrue: next })}
        />
      </div>
    );
  }

  if (def.id === 'delay') {
    return (
      <div className="fb-command-row nodrag">
        <span className="fb-command-label">Wait</span>
        <InlineNumber
          value={Number(node.config.fields['ms'] ?? 500)}
          min={0}
          max={5000}
          step={50}
          unit="ms"
          onChange={(next) => updateFields(node, { ms: next })}
        />
      </div>
    );
  }

  return null;
}

export function ActuatorNode({ data, selected }: NodeProps<ArdudeckNode>) {
  const { node, def } = data;
  const [pinSpec, setPinSpec] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const running = useStore(telemetry, (state) => state.running);
  const output = useStore(telemetry, (state) => state.outputs[node.id]?.state ?? null);
  const hasBlocks = (node.config.blocks ?? []).length > 0;

  return (
    <NodeFrame data={data} selected={selected} className="fb-node--actuator">
      <IconColumn def={def} menuOpen={menu} onMenu={() => setMenu((open) => !open)} />
      <div className="fb-node-content">
        <span className="fb-node-title">{def.name}</span>
        <span className="fb-node-sub">{def.subtitle ?? def.summary}</span>
        {def.id === 'relay' ? <RelayLoadSelect node={node} def={def} /> : null}
        {hasBlocks ? null : <ActuatorCommand node={node} def={def} />}
        {running && output ? (
          <span className="fb-live-chip fb-live-chip--output" style={outputChipStyle(output)}>
            {output}
          </span>
        ) : null}
      </div>
      <ActuatorBlocks node={node} def={def} />
      <PinStrip node={node} def={def} onChoose={setPinSpec} />
      {pinSpec ? (
        <PinPopover node={node} def={def} specId={pinSpec} onClose={() => setPinSpec(null)} />
      ) : null}
      {menu ? <MoreMenu node={node} def={def} onClose={() => setMenu(false)} /> : null}
      <Handle type="target" position={Position.Top} className="fb-handle fb-handle--target" />
      <Handle
        type="source"
        position={Position.Bottom}
        id="next"
        className="fb-handle fb-handle--next"
      />
    </NodeFrame>
  );
}

/* ----------------------------------------------------------- placeholder -- */

export function PlaceholderNode({ data }: NodeProps<PlaceholderNodeType>) {
  return (
    <div className="fb-placeholder">
      <span className="fb-placeholder-plus">
        <Icon name="plus" size={22} strokeWidth={2.6} />
      </span>
      <div className="fb-placeholder-text">
        <span className="fb-placeholder-title">{data.label}</span>
        <span className="fb-placeholder-sub">{data.sub}</span>
      </div>
      <Handle
        type="target"
        position={Position.Top}
        className="fb-handle fb-handle--placeholder"
      />
    </div>
  );
}
