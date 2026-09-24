import { useEffect, useState } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { clearFlow } from '../../state/flowOps';
import { history, redo, undo } from '../../state/history';
import { project as projectStore, renameProject } from '../../state/project';
import { useStore } from '../../state/store';
import { showToast } from '../../state/toast';
import { Icon } from '../../ui/Icon';

export function CanvasHeader() {
  const name = useStore(projectStore, (state) => state.flow.name);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  useEffect(() => setDraft(name), [name]);

  const commit = () => {
    renameProject(draft);
    setEditing(false);
    showToast('System name updated.');
  };

  return (
    <div className="fb-canvas-head">
      {editing ? (
        <input
          className="fb-title-input"
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') setEditing(false);
          }}
          aria-label="System name"
        />
      ) : (
        <>
          <h1>{name}</h1>
          <button
            type="button"
            className="fb-icon-button"
            aria-label="Rename system"
            onClick={() => setEditing(true)}
          >
            <Icon name="pencil" size={18} strokeWidth={2} />
          </button>
        </>
      )}
    </div>
  );
}

export function CanvasToolbar({
  selectedId,
  onDelete,
}: {
  selectedId: string | null;
  onDelete: () => void;
}) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const { zoom } = useViewport();
  const canUndo = useStore(history, (state) => state.canUndo);
  const canRedo = useStore(history, (state) => state.canRedo);

  return (
    <div className="fb-toolbar">
      <button
        type="button"
        className="fb-icon-button"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={() => undo()}
      >
        <Icon name="undo" size={19} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="fb-icon-button"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={() => redo()}
      >
        <Icon name="redo" size={19} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="fb-icon-button"
        aria-label="Delete selected block"
        disabled={!selectedId}
        onClick={onDelete}
      >
        <Icon name="trash" size={19} strokeWidth={2} />
      </button>
      <div className="fb-zoom">
        <button type="button" aria-label="Zoom out" onClick={() => void zoomOut({ duration: 140 })}>
          −
        </button>
        <button
          type="button"
          className="fb-zoom-value"
          aria-label="Fit view"
          onClick={() => void fitView({ duration: 260, padding: 0.2 })}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" aria-label="Zoom in" onClick={() => void zoomIn({ duration: 140 })}>
          +
        </button>
      </div>
      <button
        type="button"
        className="fb-icon-button"
        aria-label="Fit view"
        onClick={() => void fitView({ duration: 260, padding: 0.2 })}
      >
        <Icon name="grid" size={19} strokeWidth={2} />
      </button>
    </div>
  );
}

export function CanvasFooter() {
  return (
    <div className="fb-canvas-foot">
      <button
        type="button"
        className="fb-button fb-button--ghost"
        onClick={() => {
          clearFlow();
          showToast('Canvas cleared. Undo brings it back.');
        }}
      >
        <Icon name="trash" size={18} strokeWidth={2} />
        Clear All
      </button>
    </div>
  );
}
