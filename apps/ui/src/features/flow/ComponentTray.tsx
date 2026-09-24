import { useMemo, useState } from 'react';
import type { ComponentCategory, FlowNode, NodeComponentId } from '@ardudeck/core';
import { addComponent } from '../../state/flowOps';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/Icon';

interface Tile {
  name: string;
  icon: IconName;
  color: string;
  componentId?: NodeComponentId;
  soon?: boolean;
}

interface Section {
  id: ComponentCategory | 'logic';
  title: string;
  items: Tile[];
}

const SECTIONS: Section[] = [
  {
    id: 'sensor',
    title: 'Sensors',
    items: [
      { componentId: 'ldr', name: 'Light Sensor', icon: 'sun', color: 'var(--fb-yellow)' },
      { componentId: 'ultrasonic', name: 'Ultrasonic', icon: 'wave', color: 'var(--fb-sky)' },
      { componentId: 'temperature', name: 'Temperature', icon: 'thermometer', color: 'var(--fb-coral)' },
      { componentId: 'humidity', name: 'Humidity', icon: 'droplet', color: 'var(--fb-sky)' },
      { componentId: 'rain', name: 'Rain', icon: 'rain', color: 'var(--fb-sky)' },
      { componentId: 'water', name: 'Water Level', icon: 'water', color: 'var(--fb-sky)' },
      { componentId: 'touch', name: 'Touch', icon: 'hand', color: 'var(--fb-lime)' },
      { componentId: 'infrared', name: 'Infrared IR', icon: 'infrared', color: '#b9a6ff' },
      { componentId: 'sound', name: 'Sound Sensor', icon: 'sound', color: 'var(--fb-lime)' },
      { componentId: 'soil', name: 'Soil Moisture', icon: 'soil', color: '#c8a06a' },
      { componentId: 'button', name: 'Button', icon: 'button', color: 'var(--fb-lime)' },
      { componentId: 'potentiometer', name: 'Potentiometer', icon: 'knob', color: 'var(--fb-sky)' },
      { componentId: 'pir', name: 'PIR Motion', icon: 'motion', color: 'var(--fb-lime)' },
      { componentId: 'switch', name: 'Switch', icon: 'switch', color: 'var(--fb-sky)' },
    ],
  },
  {
    id: 'logic',
    title: 'Control',
    items: [
      { componentId: 'delay', name: 'Delay', icon: 'timer', color: '#b9a6ff' },
      { componentId: 'lessThan', name: 'Condition', icon: 'equal', color: '#b9a6ff' },
    ],
  },
  {
    id: 'actuator',
    title: 'Actuators',
    items: [
      { componentId: 'led', name: 'LED', icon: 'led', color: 'var(--fb-coral)' },
      { componentId: 'buzzer', name: 'Buzzer', icon: 'buzzer', color: 'var(--fb-violet)' },
      { componentId: 'servo', name: 'Servo 180', icon: 'servo', color: 'var(--fb-sky)' },
      { componentId: 'servo360', name: 'Servo 360', icon: 'servo', color: 'var(--fb-sky)' },
      { componentId: 'rgb', name: 'RGB LED', icon: 'rgb', color: '#b9a6ff' },
      { componentId: 'relay', name: 'Relay', icon: 'relay', color: 'var(--fb-yellow)' },
      { componentId: 'motor', name: 'Motor driver L298N', icon: 'motor', color: 'var(--fb-coral)' },
    ],
  },
];

export function ComponentTray({ onAdded }: { onAdded: (node: FlowNode) => void }) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState<string | null>(null);

  const sections = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return SECTIONS;
    return SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.name.toLowerCase().includes(query)),
    })).filter((section) => section.items.length > 0);
  }, [search]);

  return (
    <aside className="fb-library">
      <div className="fb-library-head">
        <h2>Components</h2>
        <label className="fb-search">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search components..."
            aria-label="Search components"
          />
          <Icon name="search" size={18} strokeWidth={2.2} />
        </label>
      </div>

      <div className="fb-library-scroll">
        {sections.map((section) => {
          const open = !collapsed[section.id];
          return (
            <section key={section.id} className="fb-section">
              <button
                type="button"
                className="fb-section-head"
                onClick={() =>
                  setCollapsed((state) => ({ ...state, [section.id]: open }))
                }
                aria-expanded={open}
              >
                <span>{section.title}</span>
                <Icon
                  name={open ? 'chevron-down' : 'chevron-up'}
                  size={16}
                  strokeWidth={2.4}
                />
              </button>

              {open ? (
                <div className="fb-tiles">
                  {section.items.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      className={`fb-tile ${item.soon ? 'fb-tile--soon' : ''} ${
                        dragging === item.name ? 'fb-tile--dragging' : ''
                      }`}
                      disabled={item.soon}
                      draggable={!item.soon}
                      onDragStart={(event) => {
                        if (!item.componentId) return;
                        event.dataTransfer.setData(
                          'application/ardudeck-component',
                          item.componentId,
                        );
                        event.dataTransfer.effectAllowed = 'copy';
                        const name = item.name;
                        window.requestAnimationFrame(() => setDragging(name));
                      }}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => {
                        if (!item.componentId) return;
                        const node = addComponent(item.componentId);
                        if (node) onAdded(node);
                      }}
                    >
                      <span className="fb-tile-icon" style={{ color: item.color }}>
                        <Icon name={item.icon} size={24} strokeWidth={2} />
                      </span>
                      <span className="fb-tile-name">{item.name}</span>
                      {item.soon ? <span className="fb-tile-soon">Soon</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}

        {sections.length === 0 ? (
          <p className="fb-library-empty">No component matches “{search}”.</p>
        ) : null}
      </div>
    </aside>
  );
}
