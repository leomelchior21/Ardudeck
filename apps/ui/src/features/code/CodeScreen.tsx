import { useMemo, useState } from 'react';
import { navigation } from '../../state/navigation';
import { go } from '../../state/navigation';
import { getCompiled, project as projectStore } from '../../state/project';
import { useStore } from '../../state/store';
import { Button } from '../../ui/Button';
import { Pill } from '../../ui/Pill';
import { TopBar } from '../../ui/TopBar';
import { tokenizeCode } from './highlight';

interface BlockChip {
  id: string;
  label: string;
}

export function CodeScreen() {
  const flow = useStore(projectStore, (state) => state.flow);
  const codeFrom = useStore(navigation, (state) => state.codeFrom);
  const compiled = getCompiled(flow);
  const [activeNode, setActiveNode] = useState<string | null>(null);

  const code = compiled.sketch?.code ?? '';
  const lineMap = useMemo(() => compiled.sketch?.lineMap ?? {}, [compiled.sketch]);
  const lines = useMemo(() => tokenizeCode(code), [code]);

  const chips = useMemo<BlockChip[]>(() => {
    const program = compiled.program;
    if (!program) return [];
    const list: BlockChip[] = [];
    for (const read of program.reads) list.push({ id: read.id, label: read.name });
    for (const rule of program.rules) {
      if (rule.condition.op === 'always') {
        list.push({ id: rule.id, label: 'Rule Always' });
      } else {
        const symbol =
          rule.condition.op === 'lt' ? '<' : rule.condition.op === 'gt' ? '>' : '=';
        list.push({ id: rule.id, label: `Rule ${symbol} ${rule.condition.value}` });
      }
    }
    for (const rule of program.rules) {
      for (const action of rule.then) {
        if (!list.some((chip) => chip.id === action.nodeId)) {
          list.push({ id: action.nodeId, label: action.name });
        }
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

  const ownerOfLine = useMemo(() => {
    const owners = new Map<number, string>();
    for (const [nodeId, ranges] of Object.entries(lineMap)) {
      for (const range of ranges) {
        for (let line = range.start; line <= range.end; line += 1) {
          if (!owners.has(line)) owners.set(line, nodeId);
        }
      }
    }
    return owners;
  }, [lineMap]);

  const back = () => {
    if (codeFrom === 'deploy') go('deploy');
    else go('flow');
  };

  return (
    <>
      <TopBar
        title="Code"
        subtitle="Every block has its own lines"
        onBack={back}
      >
        {compiled.ok ? (
          <Pill tone="accent">Generated from your flow</Pill>
        ) : (
          <Pill tone="danger">Flow is not ready</Pill>
        )}
      </TopBar>

      <div className="screen-body">
        <div className="code-screen">
          <div className="code-chips">
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`code-chip ${activeNode === chip.id ? 'code-chip--active' : ''}`}
                onClick={() => setActiveNode((current) => (current === chip.id ? null : chip.id))}
              >
                {chip.label}
              </button>
            ))}
            {chips.length === 0 ? <span className="hint">Nothing to show yet.</span> : null}
            <div className="topbar-spacer" />
            <Button
              variant="quiet"
              size="sm"
              icon="code"
              onClick={() => setActiveNode(null)}
              disabled={activeNode === null}
            >
              Clear highlight
            </Button>
          </div>

          <div className="code-scroll">
            {lines.map((tokens, index) => {
              const lineNumber = index + 1;
              const owner = ownerOfLine.get(lineNumber);
              return (
                <div
                  key={lineNumber}
                  className={`code-line ${hitLines.has(lineNumber) ? 'code-line--hit' : ''}`}
                  onClick={() => setActiveNode(owner ?? null)}
                >
                  <span className="code-gutter">{lineNumber}</span>
                  <span className="code-text">
                    {tokens.map((token, tokenIndex) => (
                      <span
                        key={`${lineNumber}-${tokenIndex}`}
                        className={token.cls === 'txt' ? undefined : `tk-${token.cls}`}
                      >
                        {token.text}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
