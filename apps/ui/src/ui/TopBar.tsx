import type { ReactNode } from 'react';
import { go } from '../state/navigation';
import { ArduOsMark } from './Brand';
import { Button } from './Button';

export interface TopBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children?: ReactNode;
}

/**
 * One bar, one way home. The Ardu OS mark always returns to the launcher;
 * Back only moves inside the current app.
 */
export function TopBar({ title, subtitle, onBack, children }: TopBarProps) {
  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar-home"
        onClick={() => go('os')}
        aria-label="Back to Ardu OS"
        title="Ardu OS"
      >
        <span className="topbar-mark">
          <ArduOsMark size={24} />
        </span>
      </button>
      {onBack ? (
        <>
          <span className="topbar-sep" />
          <Button variant="ghost" icon="back" onClick={onBack} aria-label="Back" />
        </>
      ) : null}
      <div style={{ minWidth: 0 }}>
        <div className="topbar-title">{title}</div>
        {subtitle ? <div className="topbar-sub">{subtitle}</div> : null}
      </div>
      <div className="topbar-spacer" />
      {children ? <div className="topbar-group">{children}</div> : null}
    </header>
  );
}
