import { useCallback, useEffect, useMemo, useState } from 'react';
import { getComponent } from '@ardudeck/core';
import type { ComponentDef } from '@ardudeck/core';
import type { ProjectComponent, ProjectSummary } from '../../services/types';
import { api } from '../../services/api';
import { go } from '../../state/navigation';
import {
  newProject,
  openProject,
  project as projectStore,
  renameProject,
  saveNow,
} from '../../state/project';
import { useStore } from '../../state/store';
import { showError, showToast } from '../../state/toast';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { OsNav } from '../home/OsNav';
import { BoardArt } from '../os/art';

const NAME_PRESETS = [
  'Light and LED',
  'Button alarm',
  'Night light',
  'Distance beeper',
  'Knob control',
];

const CONDITION_SYMBOL: Record<string, string> = {
  lessThan: '<',
  greaterThan: '>',
  equalsTo: '=',
  lessThanOrEqual: '≤',
  greaterThanOrEqual: '≥',
  notEquals: '≠',
};

type Tone = 'lime' | 'violet' | 'green' | 'coral' | 'sky' | 'yellow';
const GRID_TONES: Tone[] = ['green', 'coral', 'sky', 'violet', 'yellow'];

function updatedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'a while ago';
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
}

interface Chip {
  key: string;
  label: string;
  def: ComponentDef;
}

function chipFor(component: ProjectComponent): Chip | null {
  const def = getComponent(component.id);
  if (!def) return null;
  if (def.category === 'condition') {
    const value = component.value !== undefined ? ` ${component.value}` : '';
    return { key: component.id, label: `Condition ${CONDITION_SYMBOL[component.id] ?? ''}${value}`, def };
  }
  return {
    key: component.id,
    label: component.pin ? `${def.name} ${component.pin}` : def.name,
    def,
  };
}

function chipsFor(project: ProjectSummary): Chip[] {
  const seen = new Set<string>();
  const chips: Chip[] = [];
  for (const component of project.components ?? []) {
    const chip = chipFor(component);
    if (!chip || seen.has(chip.key)) continue;
    seen.add(chip.key);
    chips.push(chip);
  }
  return chips;
}

function primaryDef(project: ProjectSummary): ComponentDef | undefined {
  const defs = (project.components ?? [])
    .map((component) => getComponent(component.id))
    .filter((def): def is ComponentDef => Boolean(def));
  return defs.find((def) => def.category === 'actuator') ?? defs.find((def) => def.category === 'sensor') ?? defs[0];
}

function describeProject(project: ProjectSummary): string {
  const defs = (project.components ?? [])
    .map((component) => getComponent(component.id))
    .filter((def): def is ComponentDef => Boolean(def));
  const sensors = defs.filter((def) => def.category === 'sensor');
  const actuators = defs.filter((def) => def.category === 'actuator');
  if (sensors.length > 0 && actuators.length > 0) {
    return `${sensors[0]?.name ?? 'A sensor'} drives ${actuators.map((def) => def.name).join(' and ')}.`;
  }
  if (actuators.length > 0) {
    return `Drives ${actuators.map((def) => def.name).join(' and ')}.`;
  }
  if (sensors.length > 0) {
    return `Reads ${sensors.map((def) => def.name).join(' and ')}.`;
  }
  return `${project.nodeCount} block${project.nodeCount === 1 ? '' : 's'} ready to build.`;
}

interface ProjectCardProps {
  project: ProjectSummary;
  tone: Tone;
  badge?: string;
  wide?: boolean;
  busy?: boolean;
  current?: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function ProjectCard({
  project,
  tone,
  badge,
  wide,
  busy,
  current,
  onOpen,
  onRename,
  onDelete,
}: ProjectCardProps) {
  const [menu, setMenu] = useState(false);
  const chips = chipsFor(project);
  const primary = primaryDef(project);

  return (
    <article className={`pj-card pj-card--${tone} ${wide ? 'pj-card--wide' : ''}`}>
      <div className="pj-art" aria-hidden="true">
        {wide ? (
          <BoardArt className="pj-art-board" />
        ) : primary ? (
          <Icon name={primary.icon} size={120} strokeWidth={1.3} />
        ) : null}
      </div>

      <div className="pj-card-head">
        {badge ? <span className="pj-badge">{badge}</span> : null}
        <h3 className="pj-card-name">{project.name}</h3>
        <p className="pj-card-desc">{describeProject(project)}</p>
      </div>

      <div className="pj-chips">
        {chips.slice(0, 5).map((chip) => (
          <span key={chip.key} className="pj-chip">
            <Icon name={chip.def.icon} size={15} strokeWidth={2.2} />
            {chip.label}
          </span>
        ))}
      </div>

      <div className="pj-card-foot">
        <span className="pj-meta">
          <Icon name="chip" size={16} strokeWidth={2.2} /> Arduino Uno
        </span>
        <span className="pj-meta">Last edited {updatedLabel(project.updatedAt)}</span>
        <span className="pj-meta">v{project.version ?? 1}.0</span>
        <span className="pj-foot-actions">
          <button type="button" className="pj-open" onClick={onOpen} disabled={busy}>
            {busy ? 'Opening...' : 'Open'}
            <Icon name="arrow-right" size={17} strokeWidth={2.6} />
          </button>
          <button
            type="button"
            className="pj-more"
            aria-label={`More actions for ${project.name}`}
            aria-expanded={menu}
            onClick={() => setMenu((open) => !open)}
          >
            ⋯
          </button>
        </span>
      </div>

      {menu ? (
        <>
          <div className="pj-menu-backdrop" onClick={() => setMenu(false)} />
          <div className="pj-menu">
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onOpen();
              }}
            >
              <Icon name="external" size={15} strokeWidth={2} />
              Open
            </button>
            {current ? (
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  onRename();
                }}
              >
                <Icon name="pencil" size={15} strokeWidth={2} />
                Rename
              </button>
            ) : null}
            <button
              type="button"
              className="is-danger"
              onClick={() => {
                setMenu(false);
                onDelete();
              }}
            >
              <Icon name="trash" size={15} strokeWidth={2} />
              Delete
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
}

export function ProjectsScreen() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const currentFlowId = useStore(projectStore, (state) => state.flow.id);

  const load = useCallback(async () => {
    try {
      const result = await api.projects();
      setProjects(result.projects);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      await openProject(id);
      go('flow');
    } catch (caught) {
      showToast(
        caught instanceof Error ? caught.message : 'This project could not be opened.',
        'error',
        'The saved data may be damaged. You can start a new project.',
      );
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteProject(id);
      showToast('Project deleted.');
      await load();
    } catch (caught) {
      showError(caught);
    }
  };

  const startNew = () => {
    newProject();
    go('flow');
  };

  const beginRename = (project: ProjectSummary) => {
    setDraftName(project.name);
    setRenamingId(project.id);
  };

  const saveRename = async () => {
    renameProject(draftName);
    await saveNow({ silent: true });
    setRenamingId(null);
    await load();
    showToast('Name saved.');
  };

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    const list = projects.filter((project) => {
      if (!text) return true;
      if (project.name.toLowerCase().includes(text)) return true;
      return (project.components ?? []).some((component) => {
        const def = getComponent(component.id);
        return def?.name.toLowerCase().includes(text) ?? false;
      });
    });
    const sorted = [...list];
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return sorted;
  }, [projects, query, sort]);

  const featured = filtered[0];
  const rest = filtered.slice(1);
  const popular = [...rest].sort((a, b) => b.nodeCount - a.nodeCount)[0];
  const gridProjects = filtered.filter(
    (project) => project.id !== featured?.id && project.id !== popular?.id,
  );

  const cardProps = (project: ProjectSummary) => ({
    project,
    busy: busy === project.id,
    current: project.id === currentFlowId,
    onOpen: () => void open(project.id),
    onRename: () => beginRename(project),
    onDelete: () => void remove(project.id),
  });

  return (
    <div className="fb fb-projects">
      <OsNav active="deck" />

      <div className="pj-scroll">
        <div className="pj-shell">
          <section className="pj-hero">
            <div className="pj-hero-copy">
              <h1 className="pj-title">My Projects</h1>
              <p className="pj-sub">Your saved systems, ready to revisit, test, and evolve.</p>
            </div>
            <div className="pj-hero-side">
              <button type="button" className="pj-new" onClick={startNew}>
                <Icon name="plus" size={20} strokeWidth={2.8} />
                New Project
              </button>
              <ul className="pj-values" aria-hidden="true">
                <li>Hardware</li>
                <li>People</li>
                <li>Brighter</li>
                <li>Ideas</li>
                <li className="pj-values-rule" />
              </ul>
            </div>
          </section>

          <div className="pj-toolbar">
            <label className="pj-search">
              <Icon name="search" size={18} strokeWidth={2.2} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects..."
                aria-label="Search projects"
              />
            </label>
            <label className="pj-sort">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as 'recent' | 'name')}
                aria-label="Sort projects"
              >
                <option value="recent">Recent</option>
                <option value="name">Name</option>
              </select>
            </label>
            <div className="pj-view" role="group" aria-label="View">
              <button
                type="button"
                className={view === 'grid' ? 'is-active' : ''}
                onClick={() => setView('grid')}
                aria-label="Grid view"
                aria-pressed={view === 'grid'}
              >
                <Icon name="grid" size={18} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                className={view === 'list' ? 'is-active' : ''}
                onClick={() => setView('list')}
                aria-label="List view"
                aria-pressed={view === 'list'}
              >
                <Icon name="list" size={18} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {loading ? <p className="pj-hint">Loading projects...</p> : null}

          {error ? (
            <div className="pj-error">
              <Icon name="warning" size={18} strokeWidth={2.2} />
              <span>{error}</span>
            </div>
          ) : null}

          {!loading && !error && filtered.length === 0 ? (
            <div className="pj-empty">
              <Icon name={projects.length === 0 ? 'folder' : 'search'} size={34} strokeWidth={2.2} />
              <div className="pj-empty-title">
                {projects.length === 0 ? 'No projects yet' : 'Nothing matches'}
              </div>
              <p>
                {projects.length === 0
                  ? 'Build a flow and it is saved here automatically.'
                  : 'Try another name or clear the search.'}
              </p>
              <button type="button" className="pj-new" onClick={startNew}>
                <Icon name="plus" size={18} strokeWidth={2.8} />
                New Project
              </button>
            </div>
          ) : null}

          {filtered.length > 0 ? (
            <section className={`pj-grid ${view === 'list' ? 'pj-grid--list' : ''}`}>
              {featured ? (
                <ProjectCard {...cardProps(featured)} tone="lime" badge="Featured" wide />
              ) : null}
              {popular ? (
                <ProjectCard {...cardProps(popular)} tone="violet" badge="Popular" wide />
              ) : null}
              {gridProjects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  {...cardProps(project)}
                  tone={GRID_TONES[index % GRID_TONES.length] ?? 'sky'}
                />
              ))}
            </section>
          ) : null}
        </div>
      </div>

      <footer className="fb-footer">
        <span className="fb-footer-motto">Small boards. Big possibilities.</span>
        <span className="fb-footer-right">v1.0.0</span>
      </footer>

      {renamingId ? (
        <Sheet
          title="Project name"
          subtitle="Give your work a name"
          onClose={() => setRenamingId(null)}
          footer={
            <>
              <Button className="btn--grow" onClick={() => setRenamingId(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="btn--grow"
                icon="check"
                onClick={() => void saveRename()}
              >
                SAVE
              </Button>
            </>
          }
        >
          <div className="field">
            <input
              className="stepper-input"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              aria-label="Project name"
            />
          </div>
          <div className="field">
            <div className="field-label">Or pick one</div>
            <div className="choice-row">
              {NAME_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`choice ${draftName === preset ? 'choice--active' : ''}`}
                  onClick={() => setDraftName(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
