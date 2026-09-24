import { useState } from 'react';
import { go } from '../../state/navigation';
import { showToast } from '../../state/toast';
import { Icon } from '../../ui/Icon';
import { OsNav } from '../home/OsNav';
import { ArduinoBoard } from './ArduinoBoard';
import { CONCEPTS } from './concepts';
import type { ConceptId } from './concepts';
import { ConceptDemo } from './demos';

export function LearnScreen() {
  const [activeId, setActiveId] = useState<ConceptId>('digital');
  const [query, setQuery] = useState('');
  const active = CONCEPTS.find((concept) => concept.id === activeId) ?? CONCEPTS[0]!;
  const index = CONCEPTS.findIndex((concept) => concept.id === active.id);

  const text = query.trim().toLowerCase();
  const visible = CONCEPTS.filter(
    (concept) =>
      !text ||
      concept.label.toLowerCase().includes(text) ||
      concept.sub.toLowerCase().includes(text),
  );

  const openBuilder = () => {
    showToast('Opening the builder with this idea.');
    go('flow');
  };

  return (
    <div className="fb fb-learn" style={{ ['--learn-accent' as string]: active.accent }}>
      <OsNav active="learn" />

      <div className="learn-body">
        <aside className="learn-side">
          <div className="learn-side-head">
            <h2>Concepts</h2>
            <label className="learn-search">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                aria-label="Search concepts"
              />
              <Icon name="search" size={16} strokeWidth={2.2} />
            </label>
          </div>

          <div className="learn-list">
            {visible.map((concept) => (
              <button
                key={concept.id}
                type="button"
                className={`learn-item ${concept.id === active.id ? 'is-active' : ''}`}
                onClick={() => setActiveId(concept.id)}
              >
                <span className="learn-item-icon">
                  <Icon name={concept.icon} size={22} strokeWidth={2.2} />
                </span>
                <span className="learn-item-text">
                  <strong>{concept.label}</strong>
                  <em>{concept.sub}</em>
                </span>
                <span className="learn-item-arrow">
                  <Icon name="chevron-down" size={16} strokeWidth={2.6} />
                </span>
              </button>
            ))}
            {visible.length === 0 ? <p className="learn-list-empty">No concept matches.</p> : null}
          </div>

          <button
            type="button"
            className="learn-helper"
            onClick={() => {
              setQuery('');
              setActiveId('digital');
            }}
          >
            <span className="learn-helper-icon">
              <Icon name="sparkles" size={20} strokeWidth={2.2} />
            </span>
            <span className="learn-helper-text">
              <strong>Start with the basics</strong>
              <em>Pick a concept to explore and see it on the board.</em>
            </span>
            <span className="learn-helper-arrow">
              <Icon name="arrow-right" size={16} strokeWidth={2.6} />
            </span>
          </button>
        </aside>

        <section className="learn-stage">
          <header className="learn-stage-head">
            <div className="learn-stage-copy">
              <span className="learn-eyebrow">Explore</span>
              <h1 className="learn-stage-title">{active.title}</h1>
              <p className="learn-stage-blurb">{active.blurb}</p>
            </div>
            <div className="learn-board-badge">
              <Icon name="layers" size={20} strokeWidth={2.2} />
              <span>
                <strong>Arduino Uno</strong>
                <em>Open source. Endless possibilities.</em>
              </span>
            </div>
          </header>

          <div className="learn-board-wrap">
            <ArduinoBoard concept={active} />
          </div>

          <p className="learn-hint">
            <Icon name="target" size={16} strokeWidth={2.2} />
            Pick a concept in the list to highlight it on the board
          </p>
        </section>

        <aside className="learn-panel">
          <header className="learn-panel-head">
            <span className="learn-eyebrow">Concept</span>
            <span className="learn-count">
              {index + 1} / {CONCEPTS.length}
            </span>
          </header>

          <h2 className="learn-panel-title">{active.title}</h2>
          <p className="learn-panel-lead">{active.blurb}</p>

          <div className="learn-demo">
            <ConceptDemo concept={active} />
          </div>

          <div className="learn-why">
            <span className="learn-why-icon">
              <Icon name={active.icon} size={22} strokeWidth={2.4} />
            </span>
            <p>{active.why}</p>
          </div>

          <div className="learn-try">
            <span className="learn-try-title">
              <Icon name="code" size={15} strokeWidth={2.4} /> Try it yourself
            </span>
            <div className="learn-try-grid">
              {active.examples.map((example) => (
                <button
                  key={example.title}
                  type="button"
                  className="learn-try-card"
                  onClick={openBuilder}
                >
                  <span className="learn-try-icon">
                    <Icon name={example.icon} size={20} strokeWidth={2.2} />
                  </span>
                  <span className="learn-try-text">
                    <strong>{example.title}</strong>
                    <em>{example.sub}</em>
                  </span>
                  <Icon
                    name="chevron-down"
                    size={14}
                    strokeWidth={2.6}
                    className="learn-try-arrow"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="learn-actions">
            <button type="button" className="learn-open" onClick={openBuilder}>
              <Icon name="play" size={18} strokeWidth={2.4} />
              Open Example
              <Icon name="arrow-right" size={17} strokeWidth={2.6} />
            </button>
            <button
              type="button"
              className="learn-docs"
              onClick={() => showToast('Documentation is coming soon.')}
            >
              <Icon name="monitor" size={17} strokeWidth={2.2} />
              View Docs
            </button>
          </div>
        </aside>
      </div>

      <footer className="fb-footer">
        <span className="fb-footer-motto">Small boards. Big possibilities.</span>
        <span className="fb-footer-right">v1.0.0</span>
      </footer>
    </div>
  );
}
