import { useState } from 'react';
import { api } from '../../services/api';
import { refreshHardware } from '../../state/hardware';
import { go } from '../../state/navigation';
import { newProject } from '../../state/project';
import { showError, showToast } from '../../state/toast';
import { Icon } from '../../ui/Icon';
import { BoardArt } from '../os/art';
import { OsNav } from './OsNav';

/**
 * ArduDeck home: the starting point of the build app. One dominant
 * "New System" card plus three ways back into existing work.
 */
export function HomeScreen() {
  const [busy, setBusy] = useState(false);

  const startNew = () => {
    newProject();
    go('flow');
  };

  const trySimulation = async () => {
    setBusy(true);
    try {
      await api.setHardwareMode('on');
      await refreshHardware();
      showToast('Simulation is on. Values are not real.');
      go('live');
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fb fb-home">
      <OsNav active="deck" />

      <div className="home-main">
        <section className="home-hero">
          <div className="home-hero-copy">
            <h1 className="home-title">ArduDeck</h1>
            <p className="home-tagline">
              Turn ideas into working things with Arduino.
              <br />
              Choose a starting point to begin.
            </p>
          </div>
          <ul className="os-values home-values">
            <li>Hardware</li>
            <li>People</li>
            <li>Brighter</li>
            <li>Ideas</li>
          </ul>
        </section>

        <section className="home-cards">
          <button type="button" className="home-card home-card--new" onClick={startNew}>
            <span className="home-new-rule" aria-hidden="true" />
            <div>
              <span className="home-new-title">New System</span>
              <span className="home-new-sub">Start from scratch.</span>
            </div>
            <div className="home-new-art" aria-hidden="true">
              <BoardArt className="home-board" />
            </div>
            <span className="home-new-cta">
              Let&apos;s Build
              <Icon name="arrow-right" size={20} strokeWidth={2.6} />
            </span>
          </button>

          <button type="button" className="home-card home-card--live" onClick={() => go('live')}>
            <span className="home-card-icon">
              <Icon name="wave" size={30} strokeWidth={2.1} />
            </span>
            <span className="home-card-text">
              <span className="home-card-name">Live Sensor</span>
              <span className="home-card-sub">See the physical world in real time.</span>
            </span>
            <span className="home-card-arrow">
              <Icon name="arrow-right" size={20} strokeWidth={2.4} />
            </span>
          </button>

          <button
            type="button"
            className="home-card home-card--projects"
            onClick={() => go('projects')}
          >
            <span className="home-card-icon">
              <Icon name="folder" size={30} strokeWidth={2.1} />
            </span>
            <span className="home-card-text">
              <span className="home-card-name">Projects</span>
              <span className="home-card-sub">Continue a saved build.</span>
            </span>
            <span className="home-card-arrow">
              <Icon name="arrow-right" size={20} strokeWidth={2.4} />
            </span>
          </button>

          <button
            type="button"
            className="home-card home-card--sim"
            onClick={() => void trySimulation()}
            disabled={busy}
          >
            <span className="home-card-icon">
              <Icon name="monitor" size={30} strokeWidth={2.1} />
            </span>
            <span className="home-card-text">
              <span className="home-card-name">Try Simulation</span>
              <span className="home-card-sub">Experiment without hardware.</span>
            </span>
            <span className="home-card-arrow">
              <Icon name="arrow-right" size={20} strokeWidth={2.4} />
            </span>
          </button>
        </section>
      </div>

      <footer className="fb-footer">
        <span className="fb-footer-motto">Small boards. Big possibilities.</span>
        <span className="fb-footer-right">v1.0.0</span>
      </footer>
    </div>
  );
}
