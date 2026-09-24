import { useState } from 'react';
import { ApiError, api } from '../../services/api';
import { isDemoMode } from '../../services/mode';
import { isWebSerialSupported } from '../../services/serial';
import {
  canConnectArduino,
  connectArduino,
  describeHardware,
  hardware as hardwareStore,
} from '../../state/hardware';
import { go } from '../../state/navigation';
import { newProject, project as projectStore } from '../../state/project';
import { useStore } from '../../state/store';
import { showError, showToast } from '../../state/toast';
import { ArduDeckWordmark } from '../../ui/Brand';
import { Icon } from '../../ui/Icon';

const TABS = [
  { id: 'new', label: 'New System' },
  { id: 'projects', label: 'My Projects' },
  { id: 'learn', label: 'Learn' },
  { id: 'community', label: 'Community' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function WindowControls() {
  if (typeof window === 'undefined' || !window.arduOS?.windowControl) return null;
  return (
    <div className="fb-window-controls">
      <button
        type="button"
        aria-label="Minimize"
        onClick={() => window.arduOS?.windowControl?.('minimize')}
      >
        <Icon name="minimize" size={18} strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Maximize"
        onClick={() => window.arduOS?.windowControl?.('maximize')}
      >
        <Icon name="maximize" size={15} strokeWidth={2} />
      </button>
      <button
        type="button"
        className="fb-window-close"
        aria-label="Close"
        onClick={() => window.arduOS?.windowControl?.('close')}
      >
        <Icon name="close-x" size={18} strokeWidth={2} />
      </button>
    </div>
  );
}

export function HardwarePill() {
  const status = useStore(hardwareStore, (state) => state.hardware);
  const simulated = useStore(hardwareStore, (state) => state.simulated);
  const mockMode = useStore(hardwareStore, (state) => state.mockMode);
  const { label, tone } = describeHardware(status, simulated, mockMode);
  const connected = status.state === 'ready' || status.state === 'deployed';
  const showDetail = connected && !simulated && Boolean(status.port);
  const title = showDetail ? 'Arduino Connected' : label;
  const connectable = simulated && isDemoMode() && isWebSerialSupported();

  const openPicker = () => {
    if (!canConnectArduino()) return;
    void connectArduino().catch((error: unknown) => {
      if (error instanceof ApiError && error.code === 'cancelled') return;
      showError(error);
    });
  };

  if (connectable) {
    return (
      <button
        type="button"
        className="fb-status fb-status--accent fb-status--action"
        onClick={openPicker}
        title="Choose your Arduino in the browser dialog"
      >
        <span className="fb-status-dot" />
        <span className="fb-status-copy">
          <span className="fb-status-title">Connect Arduino</span>
          <span className="fb-status-sub">Not detected yet</span>
        </span>
      </button>
    );
  }

  if (!simulated && status.state === 'needs-bridge' && isDemoMode()) {
    return (
      <button
        type="button"
        className="fb-status fb-status--warn fb-status--action"
        onClick={() => {
          void api
            .installBridge()
            .then(() => showToast('Preparing your Arduino...'))
            .catch(showError);
        }}
        title="Install ArduDeck Bridge on the board"
      >
        <span className="fb-status-dot" />
        <span className="fb-status-copy">
          <span className="fb-status-title">Arduino needs setup</span>
          <span className="fb-status-sub">Tap to prepare</span>
        </span>
      </button>
    );
  }

  return (
    <div className={`fb-status fb-status--${tone}`}>
      <span className="fb-status-dot" />
      <span className="fb-status-copy">
        <span className="fb-status-title">{title}</span>
        {showDetail ? (
          <span className="fb-status-sub">
            {status.board ?? 'Arduino'} · {status.port}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function TopNav() {
  const nodes = useStore(projectStore, (state) => state.flow.nodes.length);
  const [active, setActive] = useState<TabId>('new');
  const [confirmNew, setConfirmNew] = useState(false);

  const onTab = (tab: TabId) => {
    if (tab === 'new') {
      if (nodes === 0) {
        setActive('new');
        return;
      }
      setConfirmNew(true);
      return;
    }
    if (tab === 'projects') {
      go('projects');
      return;
    }
    if (tab === 'learn') {
      go('learn');
      return;
    }
    showToast('Community is coming soon.');
    setActive(tab);
  };

  return (
    <header className="fb-nav">
      <button
        type="button"
        className="fb-wordmark"
        onClick={() => go('home')}
        aria-label="ArduDeck home"
        title="ArduDeck home"
      >
        <ArduDeckWordmark height={26} />
      </button>

      <nav className="fb-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`fb-tab ${active === tab.id ? 'fb-tab--active' : ''}`}
            onClick={() => onTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {confirmNew ? (
        <>
          <div className="fb-confirm-backdrop" onClick={() => setConfirmNew(false)} />
          <div className="fb-confirm">
            <p>Start a new system? Your current project is saved on this computer.</p>
            <div className="fb-confirm-actions">
              <button
                type="button"
                className="fb-button fb-button--ghost"
                onClick={() => setConfirmNew(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="fb-button fb-button--primary"
                onClick={() => {
                  newProject();
                  setConfirmNew(false);
                  setActive('new');
                  showToast('New system ready.');
                }}
              >
                Start new
              </button>
            </div>
          </div>
        </>
      ) : null}

      <div className="fb-nav-right">
        <HardwarePill />
        <WindowControls />
      </div>
    </header>
  );
}
