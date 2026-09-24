import type { ReactNode } from 'react';
import { Button } from './Button';

export interface SheetProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Sheet({ title, subtitle, onClose, children, footer }: SheetProps) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="sheet-header">
          <div>
            <div className="sheet-title">{title}</div>
            {subtitle ? <div className="hint">{subtitle}</div> : null}
          </div>
          <Button variant="ghost" icon="close" onClick={onClose} aria-label="Close" />
        </div>
        <div className="sheet-body">{children}</div>
        {footer ? <div className="sheet-footer">{footer}</div> : null}
      </div>
    </>
  );
}
