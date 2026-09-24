import { toasts as toastStore } from '../state/toast';
import { useStore } from '../state/store';
import { Icon } from './Icon';

export function Toaster() {
  const toasts = useStore(toastStore, (state) => state);
  if (toasts.length === 0) return null;
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone !== 'info' ? `toast--${toast.tone}` : ''}`}>
          <Icon
            name={toast.tone === 'error' || toast.tone === 'warn' ? 'warning' : 'check'}
            size={18}
          />
          <div>
            <div>{toast.message}</div>
            {toast.hint ? <div className="hint" style={{ color: 'rgba(255,255,255,.75)' }}>{toast.hint}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
