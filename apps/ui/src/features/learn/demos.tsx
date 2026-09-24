import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/Icon';
import type { Concept } from './concepts';

function LedIllustration({ on, fade = false }: { on?: boolean; fade?: boolean }) {
  return (
    <svg
      viewBox="0 0 70 104"
      className={`demo-led ${on ? 'is-on' : ''} ${fade ? 'is-fade' : ''}`}
      aria-hidden="true"
    >
      <ellipse cx="35" cy="40" rx="21" ry="25" className="demo-led-dome" />
      <rect x="20" y="63" width="30" height="10" rx="3" className="demo-led-base" />
      <path d="M28 73v18M42 73v18" className="demo-led-leg" />
    </svg>
  );
}

function BuzzerArt() {
  return (
    <svg viewBox="0 0 66 60" className="demo-buzzer" aria-hidden="true">
      <circle cx="26" cy="30" r="17" className="demo-buzzer-body" />
      <circle cx="26" cy="30" r="4" className="demo-buzzer-hole" />
      <path d="M44 22a12 12 0 0 1 0 16" className="demo-buzzer-wave" />
      <path d="M50 17a19 19 0 0 1 0 26" className="demo-buzzer-wave w2" />
    </svg>
  );
}

function RelayArt() {
  return (
    <svg viewBox="0 0 66 60" className="demo-relay" aria-hidden="true">
      <rect x="8" y="14" width="50" height="34" rx="5" className="demo-relay-board" />
      <circle cx="20" cy="31" r="4.5" className="demo-relay-coil" />
      <line x1="30" y1="31" x2="46" y2="31" className="demo-relay-arm" />
      <circle cx="49" cy="31" r="3" className="demo-relay-pin" />
      <circle cx="13" cy="20" r="1.6" className="demo-relay-pin" />
    </svg>
  );
}

function ServoArt() {
  return (
    <svg viewBox="0 0 80 74" className="demo-servo" aria-hidden="true">
      <rect x="16" y="30" width="40" height="32" rx="5" className="demo-servo-body" />
      <rect x="58" y="34" width="8" height="24" rx="2" className="demo-servo-body" />
      <g className="demo-servo-arm">
        <rect x="30" y="4" width="7" height="28" rx="3.5" />
        <circle cx="33.5" cy="30" r="5" />
      </g>
    </svg>
  );
}

function ValueTicker({ values, duration }: { values: number[]; duration: number }) {
  const loop = [...values, values[0] ?? 0];
  return (
    <span className="demo-value">
      <span className="demo-value-strip" style={{ animationDuration: `${duration}s` }}>
        {loop.map((value, index) => (
          <span key={index}>{value}</span>
        ))}
      </span>
    </span>
  );
}

function DigitalDemo() {
  return (
    <div className="demo demo--digital">
      <div className="demo-devices">
        <div className="demo-device">
          <LedIllustration on />
          <strong>LED</strong>
          <em>D9</em>
        </div>
        <div className="demo-device">
          <BuzzerArt />
          <strong>Buzzer</strong>
          <em>D8</em>
        </div>
        <div className="demo-device">
          <RelayArt />
          <strong>Relay</strong>
          <em>D7</em>
        </div>
      </div>
      <div className="demo-states">
        <span className="demo-state demo-state--low">
          LOW <b>0</b>
        </span>
        <span className="demo-flip">
          <Icon name="swap" size={18} strokeWidth={2.4} />
        </span>
        <span className="demo-state demo-state--high">
          HIGH <b>1</b>
        </span>
      </div>
    </div>
  );
}

function AnalogDemo() {
  return (
    <div className="demo demo--analog">
      <div className="demo-live">
        <span className="demo-live-icon demo-live-icon--sun">
          <Icon name="sun" size={22} strokeWidth={2.2} />
        </span>
        <span className="demo-live-body">
          <span className="demo-live-title">
            Light sensor <em>A0</em>
          </span>
          <span className="demo-readout">
            <i />
          </span>
        </span>
        <ValueTicker values={[120, 480, 920]} duration={4} />
      </div>
      <div className="demo-live">
        <span className="demo-live-icon demo-live-icon--knob">
          <Icon name="knob" size={22} strokeWidth={2.2} />
        </span>
        <span className="demo-live-body">
          <span className="demo-live-title">
            Potentiometer <em>A1</em>
          </span>
          <span className="demo-readout demo-readout--alt">
            <i />
          </span>
        </span>
        <ValueTicker values={[280, 640, 1000]} duration={5} />
      </div>
      <svg viewBox="0 0 280 70" className="demo-spark" aria-hidden="true">
        <path
          className="demo-spark-line"
          d="M2 58 C 40 58, 52 20, 84 20 S 120 62, 156 48 S 210 14, 246 32 S 268 52, 278 46"
        />
      </svg>
      <div className="demo-scale-labels">
        <span>dark</span>
        <span>bright</span>
      </div>
    </div>
  );
}

function PwmDemo() {
  return (
    <div className="demo demo--pwm">
      <div className="demo-devices demo-devices--two">
        <div className="demo-device">
          <LedIllustration fade />
          <strong>LED fade</strong>
          <em>D9</em>
        </div>
        <div className="demo-device">
          <ServoArt />
          <strong>Servo sweep</strong>
          <em>D5</em>
        </div>
      </div>
      <div className="demo-pulses" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, index) => (
          <span
            key={index}
            className="demo-pulse"
            style={{ animationDelay: `${index * 0.1}s` }}
          />
        ))}
      </div>
      <div className="demo-scale-labels">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function PowerDemo() {
  return (
    <div className="demo demo--power">
      <div className="demo-rail">
        <span className="demo-rail-pin">5V</span>
        <span className="demo-wire">
          <i className="demo-dot" />
        </span>
        <span className="demo-load">
          <Icon name="led" size={18} strokeWidth={2.2} /> LED
        </span>
      </div>
      <div className="demo-rail">
        <span className="demo-rail-pin demo-rail-pin--alt">3.3V</span>
        <span className="demo-wire demo-wire--alt">
          <i className="demo-dot demo-dot--alt" />
        </span>
        <span className="demo-load">
          <Icon name="knob" size={18} strokeWidth={2.2} /> Sensor
        </span>
      </div>
      <p className="demo-caption">Power flows from the board to each part.</p>
    </div>
  );
}

function GndDemo() {
  return (
    <div className="demo demo--gnd">
      <svg viewBox="0 0 280 124" className="demo-loop" aria-hidden="true">
        <path
          className="demo-loop-track"
          d="M30 36 H206 a24 24 0 0 1 24 24 v24 a24 24 0 0 1 -24 24 H54 a24 24 0 0 1 -24 -24 V36"
        />
        <path
          className="demo-loop-run"
          d="M30 36 H206 a24 24 0 0 1 24 24 v24 a24 24 0 0 1 -24 24 H54 a24 24 0 0 1 -24 -24 V36"
        />
        <circle className="demo-loop-node" cx="30" cy="36" r="6" />
      </svg>
      <div className="demo-loop-legend">
        <span>5V out</span>
        <span>GND return</span>
      </div>
    </div>
  );
}

function IoDemo() {
  return (
    <div className="demo demo--io">
      <div className="demo-io-col">
        <span className="demo-io-card">
          <Icon name="button" size={18} strokeWidth={2.2} /> Button
        </span>
        <span className="demo-io-card">
          <Icon name="sun" size={18} strokeWidth={2.2} /> Sensor
        </span>
      </div>
      <div className="demo-io-mid">
        <span className="demo-io-tag">IN</span>
        <span className="demo-io-arrow demo-io-arrow--in">
          <Icon name="arrow-right" size={16} strokeWidth={2.6} />
        </span>
        <span className="demo-io-chip">
          <Icon name="chip" size={18} strokeWidth={2.2} /> Arduino
        </span>
        <span className="demo-io-tag">OUT</span>
        <span className="demo-io-arrow demo-io-arrow--out">
          <Icon name="arrow-right" size={16} strokeWidth={2.6} />
        </span>
      </div>
      <div className="demo-io-col">
        <span className="demo-io-card">
          <Icon name="led" size={18} strokeWidth={2.2} /> LED
        </span>
        <span className="demo-io-card">
          <Icon name="buzzer" size={18} strokeWidth={2.2} /> Buzzer
        </span>
      </div>
    </div>
  );
}

function SerialDemo() {
  return (
    <div className="demo demo--serial">
      <div className="demo-serial-top">
        <span className="demo-node">
          <Icon name="monitor" size={16} strokeWidth={2.2} /> Computer
        </span>
        <span className="demo-link" aria-hidden="true">
          <i style={{ animationDelay: '0s' }} />
          <i style={{ animationDelay: '0.5s' }} />
          <i style={{ animationDelay: '1s' }} />
        </span>
        <span className="demo-node">
          <Icon name="chip" size={16} strokeWidth={2.2} /> Arduino
        </span>
      </div>
      <div className="demo-monitor" aria-hidden="true">
        <div className="demo-monitor-line" style={{ animationDelay: '0s' }}>
          &gt; Hello!
        </div>
        <div className="demo-monitor-line" style={{ animationDelay: '0.8s' }}>
          &gt; value: 480
        </div>
        <div className="demo-monitor-line" style={{ animationDelay: '1.6s' }}>
          &gt; value: 920
        </div>
      </div>
    </div>
  );
}

const PARTS: { icon: IconName; name: string; note: string }[] = [
  { icon: 'led', name: 'LED', note: 'D9' },
  { icon: 'resistor', name: 'Resistor', note: '220 Ohm' },
  { icon: 'button', name: 'Button', note: 'D2' },
  { icon: 'buzzer', name: 'Buzzer', note: 'D8' },
  { icon: 'knob', name: 'Potentiometer', note: 'A1' },
  { icon: 'sun', name: 'Light Sensor', note: 'A0' },
];

function ComponentsDemo() {
  return (
    <div className="demo demo--components">
      {PARTS.map((part) => (
        <span key={part.name} className="demo-part">
          <Icon name={part.icon} size={20} strokeWidth={2.1} />
          <strong>{part.name}</strong>
          <em>{part.note}</em>
        </span>
      ))}
    </div>
  );
}

export function ConceptDemo({ concept }: { concept: Concept }) {
  switch (concept.id) {
    case 'analog':
      return <AnalogDemo />;
    case 'pwm':
      return <PwmDemo />;
    case 'power':
      return <PowerDemo />;
    case 'gnd':
      return <GndDemo />;
    case 'io':
      return <IoDemo />;
    case 'serial':
      return <SerialDemo />;
    case 'components':
      return <ComponentsDemo />;
    case 'digital':
    default:
      return <DigitalDemo />;
  }
}
