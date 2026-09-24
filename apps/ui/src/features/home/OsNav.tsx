import { go } from '../../state/navigation';
import { showToast } from '../../state/toast';
import { ArduOsLogo } from '../../ui/Brand';
import { HardwarePill, WindowControls } from '../flow/TopNav';

const NAV = [
  { id: 'deck', label: 'ArduDeck' },
  { id: 'learn', label: 'Learn' },
  { id: 'community', label: 'Community' },
  { id: 'settings', label: 'Settings' },
] as const;

export type OsNavId = (typeof NAV)[number]['id'];

/**
 * The Ardu OS header shared by the ArduDeck app screens: launcher mark, app
 * tabs, the hardware pill and the window controls.
 */
export function OsNav({ active = 'deck' }: { active?: OsNavId }) {
  const onNav = (id: OsNavId) => {
    if (id === 'deck') go('home');
    else if (id === 'learn') go('learn');
    else if (id === 'community') showToast('Community is coming soon.');
    else if (id === 'settings') go('teacher');
  };

  return (
    <header className="fb-nav fb-home-nav">
      <button
        type="button"
        className="fb-nav-os"
        onClick={() => go('os')}
        aria-label="Back to Ardu OS"
        title="Ardu OS"
      >
        <ArduOsLogo size={20} />
      </button>
      <span className="fb-home-brand">Ardu OS</span>

      <nav className="fb-tabs">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`fb-tab ${item.id === active ? 'fb-tab--active' : ''}`}
            onClick={() => onNav(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="fb-nav-right">
        <HardwarePill />
        <WindowControls />
      </div>
    </header>
  );
}
