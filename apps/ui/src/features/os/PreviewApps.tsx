import { go } from '../../state/navigation';
import { ArduOsMark, ArduQuestMark, ArduWorldMark } from '../../ui/Brand';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/Icon';

interface PreviewCard {
  name: string;
  line: string;
  icon: IconName;
  color: string;
}

const WORLD_CARDS: PreviewCard[] = [
  { name: 'Light Theremin', line: 'Turn light into sound.', icon: 'sun', color: 'var(--lime)' },
  { name: 'Distance Drum', line: 'Play using movement.', icon: 'wave', color: 'var(--sky)' },
  { name: 'Smart Plant', line: 'See what a plant senses.', icon: 'plant', color: 'var(--lavender)' },
  { name: 'Weather Box', line: 'Read your environment.', icon: 'cloud', color: 'var(--yellow)' },
  { name: 'Reaction Lab', line: 'Measure reflexes.', icon: 'bolt', color: 'var(--coral)' },
  { name: 'Interactive Art', line: 'Make the room respond.', icon: 'sparkles', color: 'var(--violet-soft)' },
];

const QUEST_CARDS: PreviewCard[] = [
  { name: 'Dark Hunter', line: 'Find the darkest location.', icon: 'moon', color: 'var(--lime)' },
  { name: '30 CM', line: 'Find exactly 30 centimeters.', icon: 'ruler', color: 'var(--sky)' },
  { name: 'Mystery Box', line: 'Discover the hidden rule.', icon: 'box', color: 'var(--yellow)' },
  { name: 'Alarm Lab', line: 'Build something that reacts.', icon: 'bell', color: 'var(--lavender)' },
  { name: 'Signal Hunt', line: 'Decode a physical signal.', icon: 'radio', color: 'var(--violet-soft)' },
  { name: 'Final Boss', line: 'Solve a multi-sensor system.', icon: 'target', color: 'var(--coral)' },
];

function PreviewApp({
  app,
  titleFirst,
  titleSecond,
  philosophy,
  intro,
  cards,
}: {
  app: 'world' | 'quest';
  titleFirst: string;
  titleSecond: string;
  philosophy: string;
  intro: string;
  cards: PreviewCard[];
}) {
  const Mark = app === 'world' ? ArduWorldMark : ArduQuestMark;
  return (
    <div className={`preview preview--${app}`}>
      <div className="preview-frame">
        <header className="preview-top">
          <Button variant="ghost" icon="back" onClick={() => go('os')}>
            Ardu OS
          </Button>
          <Mark size={30} />
          <span className="os-brand-sub">
            {titleFirst} {titleSecond}
          </span>
          <span className="preview-philosophy">{philosophy}</span>
        </header>

        <div className="preview-head">
          <h1 className="preview-title">
            {titleFirst}
            <em>{titleSecond}</em>
          </h1>
          <p className="preview-line">{intro}</p>
        </div>

        <div className="preview-grid">
          {cards.map((card, index) => (
            <article key={card.name} className="preview-card">
              <div className="preview-card-top">
                <span className="preview-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="preview-icon" style={{ background: card.color }}>
                  <Icon name={card.icon} size={20} strokeWidth={2.2} />
                </span>
              </div>
              <h2 className="preview-name">{card.name}</h2>
              <p className="preview-desc">{card.line}</p>
              <span className="preview-soon">Coming soon</span>
            </article>
          ))}
        </div>

        <footer className="os-foot">
          <ArduOsMark size={18} />
          <span>These experiences are not available yet</span>
          <span className="os-foot-sep" />
          <span>ArduDeck is the app to use today</span>
        </footer>
      </div>
    </div>
  );
}

export function ArduWorldScreen() {
  return (
    <PreviewApp
      app="world"
      titleFirst="Ardu"
      titleSecond="World"
      philosophy="Connect · Experience · Change · Observe"
      intro="Real-world physical computing experiences. Put a sensor in the middle of the room and watch what happens."
      cards={WORLD_CARDS}
    />
  );
}

export function ArduQuestScreen() {
  return (
    <PreviewApp
      app="quest"
      titleFirst="Ardu"
      titleSecond="Quest"
      philosophy="Mission · Investigate · Build · Test · Solve"
      intro="Physical challenges where you are not given the complete solution. Investigate, build and prove it works."
      cards={QUEST_CARDS}
    />
  );
}
