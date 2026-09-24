import { useMemo, useState } from 'react';
import type { CompileResult, Flow } from '@ardudeck/core';
import { getComponent } from '@ardudeck/core';
import { tokenizeCode } from '../../code/highlight';
import { showToast } from '../../../state/toast';
import { Icon } from '../../../ui/Icon';

interface CodeCheckPanelProps {
  flow: Flow;
  compiled: CompileResult;
  /** Code currently flashed on the board, when live mode has run at least once. */
  runningCode: string | null;
  liveActive: boolean;
  changedSinceDeploy: boolean;
  onSend: () => void;
  onBackToLive: () => void;
}

export function CodeCheckPanel({
  flow,
  compiled,
  runningCode,
  liveActive,
  changedSinceDeploy,
  onSend,
  onBackToLive,
}: CodeCheckPanelProps) {
  const [tab, setTab] = useState<'code' | 'blocks'>('code');
  const [showRunning, setShowRunning] = useState(false);
  const [activeNode, setActiveNode] = useState<string | null>(null);

  const generated = compiled.sketch?.code ?? '';
  const inspectingRunning = liveActive && runningCode !== null && (showRunning || !changedSinceDeploy);
  const code = inspectingRunning && runningCode ? runningCode : generated;
  const lineMap = useMemo(
    () => (inspectingRunning ? {} : (compiled.sketch?.lineMap ?? {})),
    [inspectingRunning, compiled.sketch],
  );
  const lines = useMemo(() => tokenizeCode(code), [code]);

  const blocks = useMemo(() => {
    const program = compiled.program;
    if (!program) return [];
    const list: { id: string; kind: string; label: string }[] = [];
    for (const read of program.reads) {
      list.push({ id: read.id, kind: 'sensor', label: `${read.name}${read.pin ? ` · ${read.pin}` : ''}` });
    }
    for (const rule of program.rules) {
      const symbol =
        rule.condition.op === 'lt'
          ? '<'
          : rule.condition.op === 'gt'
            ? '>'
            : rule.condition.op === 'lte'
              ? '≤'
              : rule.condition.op === 'gte'
                ? '≥'
                : rule.condition.op === 'neq'
                  ? '≠'
                  : '=';
      list.push({ id: rule.id, kind: 'condition', label: `Condition ${symbol} ${rule.condition.value}` });
      for (const action of [...rule.then, ...rule.else]) {
        if (list.some((item) => item.id === action.nodeId)) continue;
        list.push({ id: action.nodeId, kind: 'actuator', label: `${action.name} · ${action.pin}` });
      }
    }
    return list;
  }, [compiled.program]);

  const hitLines = useMemo(() => {
    const hits = new Set<number>();
    if (!activeNode) return hits;
    for (const range of lineMap[activeNode] ?? []) {
      for (let line = range.start; line <= range.end; line += 1) hits.add(line);
    }
    return hits;
  }, [activeNode, lineMap]);

  const errors = compiled.validation.errors;
  const valid = compiled.ok;

  return (
    <div className="fb-panel-body">
      {inspectingRunning ? (
        <div className="fb-banner fb-banner--info">
          <Icon name="lock" size={16} strokeWidth={2.2} />
          <span>
            Showing the code running on the Arduino.
            {changedSinceDeploy ? ' Your graph has newer changes.' : ''}
          </span>
          {changedSinceDeploy ? (
            <button type="button" onClick={() => setShowRunning(false)}>
              Show generated
            </button>
          ) : null}
        </div>
      ) : liveActive && runningCode ? (
        <div className="fb-banner fb-banner--warn">
          <span>These changes are not on the Arduino yet.</span>
          <button type="button" onClick={() => setShowRunning(true)}>
            Show running code
          </button>
        </div>
      ) : null}

      <div className="fb-segmented">
        <button
          type="button"
          className={tab === 'code' ? 'is-active' : ''}
          onClick={() => setTab('code')}
        >
          Arduino Code
        </button>
        <button
          type="button"
          className={tab === 'blocks' ? 'is-active' : ''}
          onClick={() => setTab('blocks')}
        >
          Blocks View
        </button>
        <button
          type="button"
          className="fb-copy"
          aria-label="Copy code"
          title="Copy code"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(
              () => showToast('Code copied.'),
              () => showToast('Could not copy the code.', 'warn'),
            );
          }}
        >
          <Icon name="copy" size={16} strokeWidth={2} />
        </button>
      </div>

      {tab === 'blocks' ? (
        <div className="fb-blocks">
          {blocks.map((block) => (
            <button
              key={`${block.id}-${block.kind}`}
              type="button"
              className={`fb-block fb-block--${block.kind} ${
                activeNode === block.id ? 'is-active' : ''
              }`}
              onClick={() => {
                setActiveNode((current) => (current === block.id ? null : block.id));
                setTab('code');
              }}
            >
              {block.label}
            </button>
          ))}
          {blocks.length === 0 ? <p className="fb-blocks-empty">Nothing to show yet.</p> : null}
        </div>
      ) : code.trim().length === 0 ? (
        <div className="fb-code fb-code--empty">
          <p className="fb-code-empty">
            {compiled.ok
              ? 'The code will appear here as you build.'
              : `The code appears when the flow is ready: ${compiled.validation.summary}`}
          </p>
        </div>
      ) : (
        <div className="fb-code">
          {lines.map((tokens, index) => {
            const lineNumber = index + 1;
            return (
              <div
                key={lineNumber}
                className={`fb-code-line ${hitLines.has(lineNumber) ? 'is-hit' : ''}`}
              >
                <span className="fb-code-gutter">{lineNumber}</span>
                <span className="fb-code-text">
                  {tokens.map((token, tokenIndex) => (
                    <span
                      key={`${lineNumber}-${tokenIndex}`}
                      className={token.cls === 'txt' ? undefined : `fb-tk-${token.cls}`}
                    >
                      {token.text}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="fb-panel-foot">
        {valid ? (
          <div className="fb-valid">
            <span className="fb-valid-icon">
              <Icon name="check" size={18} strokeWidth={3} />
            </span>
            <span>
              <strong>Code is valid!</strong>
              <em>Ready to upload to Arduino.</em>
            </span>
          </div>
        ) : (
          <div className="fb-invalid">
            <span className="fb-invalid-icon">
              <Icon name="warning" size={18} strokeWidth={2.6} />
            </span>
            <span>
              <strong>
                {errors.length} {errors.length === 1 ? 'thing' : 'things'} to fix
              </strong>
              <em>{compiled.validation.summary}</em>
            </span>
          </div>
        )}
        {liveActive ? (
          <button type="button" className="fb-button fb-button--ghost" onClick={onBackToLive}>
            Back to Live
          </button>
        ) : (
          <button
            type="button"
            className="fb-button fb-button--send"
            disabled={!valid}
            onClick={onSend}
          >
            <Icon name="upload" size={19} strokeWidth={2.4} />
            SEND TO THE ARDUINO
          </button>
        )}
      </div>

      {!valid && errors[0]?.nodeId ? (
        <p className="fb-panel-hint">
          Fix the highlighted card: {getComponent(
            flow.nodes.find((node) => node.id === errors[0]?.nodeId)?.componentId ?? 'ldr',
          )?.name ?? 'block'}
        </p>
      ) : null}
    </div>
  );
}
