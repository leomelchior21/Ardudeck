import type { Concept } from './concepts';

const DIGITAL = { x: 218, y: 150, gap: 25, w: 16, h: 16 };
const DIGITAL_LABELS = [
  'D13',
  'D12',
  'D11',
  'D10',
  'D9',
  'D8',
  'D7',
  'D6',
  'D5',
  'D4',
  'D3',
  'D2',
  'D1',
  'D0',
];
const PWM_LABELS = new Set(['D3', 'D5', 'D6', 'D9', 'D10', 'D11']);

const ANALOG = { x: 438, y: 428, gap: 28, w: 18, h: 16 };
const ANALOG_LABELS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];

const POWER = { x: 218, y: 428, gap: 26, w: 16, h: 16 };
const POWER_LABELS = ['RST', 'RST', '3V3', '5V', 'GND', 'GND', 'VIN'];

interface CalloutSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  to: [number, number];
}

const CALLOUTS: Partial<Record<Concept['id'], CalloutSpec[]>> = {
  digital: [
    {
      x: 250,
      y: 26,
      w: 320,
      h: 50,
      label: 'Digital Pins (D0 - D13)',
      sub: 'Can be INPUT or OUTPUT (HIGH or LOW)',
      to: [430, 146],
    },
  ],
  analog: [
    {
      x: 498,
      y: 514,
      w: 252,
      h: 50,
      label: 'Analog Pins (A0 - A5)',
      sub: 'Read values 0 - 1023',
      to: [521, 448],
    },
  ],
  pwm: [
    {
      x: 250,
      y: 26,
      w: 230,
      h: 50,
      label: 'PWM ~',
      sub: 'Pins 3, 5, 6, 9, 10, 11',
      to: [372, 146],
    },
  ],
  power: [
    {
      x: 136,
      y: 514,
      w: 200,
      h: 50,
      label: 'Power Pins',
      sub: '3.3V, 5V, VIN',
      to: [300, 450],
    },
  ],
  gnd: [
    {
      x: 300,
      y: 514,
      w: 170,
      h: 50,
      label: 'GND',
      sub: 'Common ground',
      to: [343, 450],
    },
  ],
  io: [
    {
      x: 136,
      y: 514,
      w: 180,
      h: 50,
      label: 'INPUT',
      sub: 'Read a button or sensor',
      to: [300, 450],
    },
    {
      x: 520,
      y: 514,
      w: 192,
      h: 50,
      label: 'OUTPUT',
      sub: 'Drive an LED or buzzer',
      to: [521, 450],
    },
  ],
  serial: [
    {
      x: 640,
      y: 108,
      w: 200,
      h: 50,
      label: 'Serial (TX / RX)',
      sub: 'D1 = TX, D0 = RX',
      to: [548, 150],
    },
    {
      x: 26,
      y: 164,
      w: 132,
      h: 50,
      label: 'USB',
      sub: 'Power + data',
      to: [190, 212],
    },
  ],
  components: [
    { x: 26, y: 164, w: 140, h: 50, label: 'USB', sub: 'Power + data', to: [190, 212] },
    { x: 26, y: 418, w: 150, h: 50, label: 'DC Power', sub: '7 - 12V (VIN)', to: [190, 366] },
    {
      x: 250,
      y: 26,
      w: 240,
      h: 50,
      label: 'Microcontroller',
      sub: 'The brain of the board',
      to: [440, 250],
    },
    {
      x: 640,
      y: 296,
      w: 200,
      h: 50,
      label: 'Status LEDs',
      sub: 'ON, TX, RX, L',
      to: [612, 250],
    },
  ],
};

function Callout({ spec }: { spec: CalloutSpec }) {
  const cx = spec.x + spec.w / 2;
  const startY = spec.to[1] < spec.y ? spec.y : spec.y + spec.h;
  const midY = (startY + spec.to[1]) / 2;
  return (
    <g className="learn-callout">
      <path
        className="learn-callout-line"
        d={`M ${cx} ${startY} L ${cx} ${midY} L ${spec.to[0]} ${midY} L ${spec.to[0]} ${spec.to[1]}`}
      />
      <rect
        className="learn-callout-box"
        x={spec.x}
        y={spec.y}
        width={spec.w}
        height={spec.h}
        rx={12}
      />
      <text
        className="learn-callout-title"
        x={cx}
        y={spec.y + (spec.sub ? 22 : 31)}
        textAnchor="middle"
      >
        {spec.label}
      </text>
      {spec.sub ? (
        <text className="learn-callout-sub" x={cx} y={spec.y + 38} textAnchor="middle">
          {spec.sub}
        </text>
      ) : null}
    </g>
  );
}

/** One gold pin sitting in a black header cavity. */
function HeaderPin({
  x,
  y,
  w,
  h,
  hot,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  hot: boolean;
}) {
  return (
    <>
      <rect className="learn-slot" x={x - 1.5} y={y - 1.5} width={w + 3} height={h + 3} rx={3} />
      <rect className={hot ? 'learn-pin is-hot' : 'learn-pin'} x={x} y={y} width={w} height={h} rx={2.5} />
    </>
  );
}

/**
 * A detailed but educationally clear Arduino Uno. The selected concept decides
 * which pins glow and which callouts are drawn.
 */
export function ArduinoBoard({ concept }: { concept: Concept }) {
  const hotDigital = concept.id === 'digital' || concept.id === 'io';
  const hotAnalog = concept.id === 'analog' || concept.id === 'io';
  const hotPwm = concept.id === 'pwm';
  const hotSerial = concept.id === 'serial';
  const hotPower = concept.id === 'power';
  const hotGnd = concept.id === 'gnd';
  const hotParts = concept.id === 'components';
  const callouts = CALLOUTS[concept.id] ?? [];

  const digitalStripHot = hotDigital || hotPwm || hotSerial;
  const powerStripHot = hotPower || hotGnd;

  return (
    <svg
      className="learn-board"
      viewBox="20 18 820 570"
      role="img"
      aria-label={`Arduino Uno with ${concept.title} highlighted`}
    >
      <defs>
        <linearGradient id="learn-board" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#1096bd" />
          <stop offset="0.5" stopColor="#0c7ba1" />
          <stop offset="1" stopColor="#07536f" />
        </linearGradient>
        <linearGradient id="learn-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6ebf0" />
          <stop offset="0.5" stopColor="#b9c1ca" />
          <stop offset="1" stopColor="#8f98a3" />
        </linearGradient>
        <linearGradient id="learn-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2d98a" />
          <stop offset="1" stopColor="#c79b3c" />
        </linearGradient>
        <radialGradient id="learn-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" style={{ stopColor: 'var(--learn-accent)', stopOpacity: 0.4 }} />
          <stop offset="1" style={{ stopColor: 'var(--learn-accent)', stopOpacity: 0 }} />
        </radialGradient>
      </defs>

      <ellipse cx="430" cy="290" rx="330" ry="240" fill="url(#learn-glow)" className="learn-halo" />

      {/* Board body */}
      <rect
        x={130}
        y={90}
        width={560}
        height={400}
        rx={28}
        fill="url(#learn-board)"
        stroke="#053f56"
        strokeWidth={3}
      />
      <rect
        x={140}
        y={100}
        width={540}
        height={380}
        rx={24}
        fill="none"
        stroke="#eaf7fc"
        strokeOpacity={0.16}
        strokeWidth={1.5}
      />

      {[
        [158, 116],
        [662, 116],
        [158, 464],
        [662, 464],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r={11} fill="#053f56" />
          <circle cx={cx} cy={cy} r={6.5} fill="#0a5f7d" />
        </g>
      ))}

      {/* USB-B connector */}
      <g className={hotSerial || hotParts ? 'learn-part is-hot' : 'learn-part'}>
        <rect x={138} y={168} width={104} height={86} rx={6} fill="url(#learn-metal)" />
        <rect x={150} y={178} width={72} height={66} rx={4} fill="#7d8790" />
        <rect x={166} y={190} width={40} height={42} rx={3} fill="#59626b" />
        <rect x={138} y={210} width={14} height={30} rx={3} fill="#9aa4ae" />
      </g>

      {/* Barrel power jack */}
      <g className={hotParts ? 'learn-part is-hot' : 'learn-part'}>
        <rect x={138} y={318} width={104} height={96} rx={7} fill="#16171b" />
        <circle cx={196} cy={366} r={30} fill="#24252b" />
        <circle cx={196} cy={366} r={12} fill="#0b0c0f" />
        <rect x={138} y={330} width={16} height={70} rx={3} fill="#2c2d33" />
      </g>

      {/* Digital header */}
      <rect
        x={210}
        y={142}
        width={380}
        height={30}
        rx={4}
        fill="#050d10"
        className={digitalStripHot ? 'learn-strip is-hot' : 'learn-strip'}
      />
      {DIGITAL_LABELS.map((label, index) => {
        const x = DIGITAL.x + index * DIGITAL.gap;
        const hot =
          hotDigital ||
          (hotPwm && PWM_LABELS.has(label)) ||
          (hotSerial && (label === 'D0' || label === 'D1'));
        return (
          <g key={label}>
            <text className="learn-pin-label" x={x + DIGITAL.w / 2} y={134} textAnchor="middle">
              {label}
            </text>
            <HeaderPin x={x} y={DIGITAL.y} w={DIGITAL.w} h={DIGITAL.h} hot={hot} />
            {PWM_LABELS.has(label) ? (
              <text
                className={hotPwm ? 'learn-tilde is-hot' : 'learn-tilde'}
                x={x + DIGITAL.w / 2}
                y={184}
                textAnchor="middle"
              >
                ~
              </text>
            ) : null}
          </g>
        );
      })}
      <text className="learn-silk" x={400} y={202} textAnchor="middle">
        DIGITAL (PWM~)
      </text>

      {/* Analog header */}
      <rect
        x={430}
        y={420}
        width={182}
        height={30}
        rx={4}
        fill="#050d10"
        className={hotAnalog ? 'learn-strip is-hot' : 'learn-strip'}
      />
      {ANALOG_LABELS.map((label, index) => {
        const x = ANALOG.x + index * ANALOG.gap;
        return (
          <g key={label}>
            <text className="learn-pin-label" x={x + ANALOG.w / 2} y={412} textAnchor="middle">
              {label}
            </text>
            <HeaderPin x={x} y={ANALOG.y} w={ANALOG.w} h={ANALOG.h} hot={hotAnalog} />
          </g>
        );
      })}
      <text className="learn-silk" x={521} y={474} textAnchor="middle">
        ANALOG IN
      </text>

      {/* Power header */}
      <rect
        x={210}
        y={420}
        width={182}
        height={30}
        rx={4}
        fill="#050d10"
        className={powerStripHot ? 'learn-strip is-hot' : 'learn-strip'}
      />
      {POWER_LABELS.map((label, index) => {
        const x = POWER.x + index * POWER.gap;
        const isPower = label === '3V3' || label === '5V' || label === 'VIN';
        const hot = (hotPower && isPower) || (hotGnd && label === 'GND');
        return (
          <g key={`${label}-${index}`}>
            <text className="learn-pin-label" x={x + POWER.w / 2} y={412} textAnchor="middle">
              {label}
            </text>
            <HeaderPin x={x} y={POWER.y} w={POWER.w} h={POWER.h} hot={hot} />
          </g>
        );
      })}
      <text className="learn-silk" x={301} y={474} textAnchor="middle">
        POWER
      </text>

      {/* Microcontroller with pin legs */}
      <g className={hotParts ? 'learn-part is-hot' : 'learn-part'}>
        <rect x={352} y={248} width={178} height={62} rx={6} fill="#111318" stroke="#242a31" strokeWidth={1.5} />
        <text className="learn-chip-text" x={441} y={286} textAnchor="middle">
          ATmega328P
        </text>
        {Array.from({ length: 12 }).map((_, index) => (
          <rect
            key={`top-${index}`}
            x={362 + index * 13.5}
            y={240}
            width={7}
            height={11}
            rx={1.5}
            fill="url(#learn-gold)"
          />
        ))}
        {Array.from({ length: 12 }).map((_, index) => (
          <rect
            key={`bottom-${index}`}
            x={362 + index * 13.5}
            y={307}
            width={7}
            height={11}
            rx={1.5}
            fill="url(#learn-gold)"
          />
        ))}
      </g>

      {/* Crystal + load caps */}
      <ellipse cx={300} cy={296} rx={20} ry={9} fill="#c3cad1" stroke="#8f98a3" />
      <circle cx={268} cy={296} r={8} fill="#2a2d33" />
      <circle cx={332} cy={296} r={8} fill="#2a2d33" />

      {/* Voltage regulator */}
      <rect x={250} y={342} width={64} height={44} rx={4} fill="#14161a" stroke="#242a31" />
      <rect x={262} y={334} width={40} height={12} rx={2} fill="#9aa4ae" />

      {/* Electrolytic capacitors */}
      <circle cx={470} cy={366} r={17} fill="#1c1e23" stroke="#2c3138" />
      <circle cx={470} cy={366} r={17} fill="none" stroke="#c3cad1" strokeOpacity={0.5} strokeWidth={2} />
      <circle cx={512} cy={366} r={12} fill="#1c1e23" stroke="#2c3138" />

      {/* ICSP header */}
      <rect x={296} y={398} width={54} height={16} rx={3} fill="#050d10" />
      {Array.from({ length: 6 }).map((_, index) => (
        <rect
          key={`icsp-${index}`}
          x={300 + (index % 3) * 17}
          y={400 + Math.floor(index / 3) * 6}
          width={7}
          height={5}
          rx={1}
          fill="url(#learn-gold)"
        />
      ))}

      {/* Reset button */}
      <g className={hotParts ? 'learn-part is-hot' : 'learn-part'}>
        <circle cx={300} cy={198} r={14} fill="#c53a30" />
        <circle cx={300} cy={198} r={7} fill="#9c281f" />
      </g>
      <text className="learn-silk" x={300} y={226} textAnchor="middle" style={{ fontSize: 8 }}>
        RESET
      </text>

      {/* Status LEDs */}
      <g className={hotParts ? 'learn-part is-hot' : 'learn-part'}>
        <circle cx={612} cy={214} r={7} fill="#4ade80" />
        <circle cx={612} cy={238} r={6} fill="#f6d84b" />
        <circle cx={612} cy={260} r={6} fill="#f2544b" />
        <circle cx={612} cy={284} r={6} fill="#4ade80" />
      </g>
      <text className="learn-silk" x={638} y={217} style={{ fontSize: 8 }}>
        TX
      </text>
      <text className="learn-silk" x={638} y={241} style={{ fontSize: 8 }}>
        RX
      </text>
      <text className="learn-silk" x={638} y={263} style={{ fontSize: 8 }}>
        L
      </text>
      <text className="learn-silk" x={638} y={287} style={{ fontSize: 8 }}>
        ON
      </text>

      {/* Branding */}
      <path
        d="M392 348c7.5-12 18.5-12 26 0s18.5 12 26 0"
        fill="none"
        stroke="#eaf7fc"
        strokeWidth={4.5}
        strokeLinecap="round"
      />
      <text className="learn-logo-text" x={440} y={392} textAnchor="middle">
        UNO
      </text>
      <text className="learn-silk" x={440} y={408} textAnchor="middle" style={{ letterSpacing: 4 }}>
        ARDUINO
      </text>

      {callouts.map((spec) => (
        <Callout key={spec.label} spec={spec} />
      ))}
    </svg>
  );
}
