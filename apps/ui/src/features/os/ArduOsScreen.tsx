import { describeHardware, hardware as hardwareStore } from '../../state/hardware';
import { go } from '../../state/navigation';
import { useStore } from '../../state/store';
import { showToast } from '../../state/toast';
import { ArduOsLogo } from '../../ui/Brand';
import { Icon } from '../../ui/Icon';
import { useHoldToUnlock } from '../../ui/useHoldToUnlock';
import { BoardArt, GlobeArt, MountainsArt } from './art';

const NAV: { label: string; active?: boolean; onOpen: () => void }[] = [
  { label: 'Home', active: true, onOpen: () => go('os') },
  { label: 'Projects', onOpen: () => go('projects') },
  { label: 'Learn', onOpen: () => go('learn') },
  { label: 'Community', onOpen: () => showToast('Community is coming soon.') },
];

function HardwareState() {
  const status = useStore(hardwareStore, (state) => state.hardware);
  const simulated = useStore(hardwareStore, (state) => state.simulated);
  const mockMode = useStore(hardwareStore, (state) => state.mockMode);
  const { label, tone } = describeHardware(status, simulated, mockMode);
  return (
    <div className={`os-status os-status--${tone}`}>
      <span className="os-status-dot" />
      {label}
    </div>
  );
}

/**
 * The Ardu OS launcher: one dark operating environment, three apps.
 * ArduDeck is the complete app and visually dominates; ArduWorld and
 * ArduQuest are polished previews.
 */
export function ArduOsScreen() {
  const { holding, handlers } = useHoldToUnlock(() => go('teacher'));
  const gear = useHoldToUnlock(() => go('teacher'), 1500);

  return (
    <div className="os">
      <span className="os-blob os-blob--left" aria-hidden="true" />
      <span className="os-blob os-blob--right" aria-hidden="true" />

      <div className="os-frame">
        <nav className="os-nav">
          <button
            type="button"
            className="os-logo"
            {...handlers}
            aria-label="Ardu OS. Hold for teacher options."
          >
            <ArduOsLogo size={32} />
            <span className="os-wordmark">Ardu OS</span>
            {holding ? <span className="os-hold" /> : null}
          </button>

          <div className="os-nav-links">
            {NAV.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`os-nav-link ${item.active ? 'os-nav-link--active' : ''}`}
                onClick={item.onOpen}
              >
                {item.label}
              </button>
            ))}
          </div>

          <HardwareState />

          <button
            type="button"
            className="os-gear"
            {...gear.handlers}
            aria-label="Hold for teacher options"
            title="Hold for teacher options"
          >
            <Icon name="gear" size={22} strokeWidth={1.9} />
            {gear.holding ? <span className="os-hold os-hold--gear" /> : null}
          </button>
        </nav>

        <section className="os-hero">
          <div className="os-hero-copy">
            <h1 className="os-headline">
              Make
              <br />
              <em>Real</em> Things.
            </h1>
            <p className="os-sub">
              Build, explore, and solve with real components.
              <br />A more hands-on tomorrow starts here.
            </p>
          </div>
          <div className="os-hero-side">
            <div className="os-note">Ideas into reality</div>
            <ul className="os-values">
              <li>Hardware</li>
              <li>People</li>
              <li>Brighter</li>
              <li>Ideas</li>
            </ul>
          </div>
        </section>

        <section className="os-apps">
          <button type="button" className="os-app os-app--deck" onClick={() => go('home')}>
            <div className="os-app-top">
              <div>
                <h2 className="os-app-title">ArduDeck</h2>
                <div className="os-app-purpose">Build</div>
              </div>
              <div className="os-deck-side">
                <span className="os-dots" aria-hidden="true" />
                <span className="os-code-words">
                  Code
                  <br />
                  Connect
                  <br />
                  Create
                </span>
              </div>
            </div>
            <p className="os-app-desc">Create real physical systems with Arduino.</p>
            <div className="os-app-foot">
              <span className="os-launch">
                <Icon name="arrow-right" size={26} strokeWidth={2.6} />
              </span>
              <span className="os-foot-label">Launch</span>
            </div>
            <div className="os-art os-art--board">
              <BoardArt className="os-board" />
            </div>
          </button>

          <button type="button" className="os-app os-app--world" onClick={() => go('world')}>
            <span className="os-tag os-tag--preview">Preview</span>
            <div className="os-art os-art--center">
              <GlobeArt className="os-globe" />
            </div>
            <h2 className="os-app-title">ArduWorld</h2>
            <div className="os-app-purpose os-app-purpose--lavender">Explore</div>
            <p className="os-app-desc">
              Discover projects, examples, and ideas from around the world.
            </p>
            <div className="os-app-foot">
              <span className="os-launch os-launch--muted">
                <Icon name="arrow-right" size={22} strokeWidth={2.4} />
              </span>
              <span className="os-foot-label">Coming soon</span>
            </div>
          </button>

          <button type="button" className="os-app os-app--quest" onClick={() => go('quest')}>
            <span className="os-tag">Soon</span>
            <div className="os-art os-art--center">
              <MountainsArt className="os-mountains" />
            </div>
            <h2 className="os-app-title">ArduQuest</h2>
            <div className="os-app-purpose os-app-purpose--lime">Solve</div>
            <p className="os-app-desc">Take on challenges, build your skills.</p>
            <div className="os-app-foot">
              <span className="os-launch os-launch--muted">
                <Icon name="arrow-right" size={22} strokeWidth={2.4} />
              </span>
              <span className="os-foot-label">Coming soon</span>
            </div>
          </button>
        </section>

        <footer className="os-footer">
          <span className="os-motto">Small boards. Big possibilities.</span>
          <span className="os-pager" aria-hidden="true">
            <span className="os-pager-line" />
            <span className="os-pager-dot os-pager-dot--active" />
            <span className="os-pager-dot" />
            <span className="os-pager-dot" />
          </span>
        </footer>
      </div>
    </div>
  );
}
