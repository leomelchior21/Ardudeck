import { useEffect, useMemo, useState } from 'react';
import { getComponent, pinsForKinds } from '@ardudeck/core';
import type { ComponentDef, NodeComponentId, PinId } from '@ardudeck/core';
import { ApiError, api } from '../../services/api';
import { isDemoMode } from '../../services/mode';
import { isWebSerialSupported } from '../../services/serial';
import { go } from '../../state/navigation';
import { lastReading, rememberReading } from '../../state/lastReading';
import { startRuleFromReading } from '../../state/flowOps';
import { connectArduino, hardware as hardwareStore, refreshHardware } from '../../state/hardware';
import { showError, showToast } from '../../state/toast';
import { useStore } from '../../state/store';
import { Button } from '../../ui/Button';
import { HardwarePill } from '../../ui/Pill';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/Icon';
import { Meter } from '../../ui/Meter';
import { PinPicker } from '../../ui/PinPicker';
import { Sparkline } from '../../ui/Sparkline';
import { TopBar } from '../../ui/TopBar';
import { useSensorReading } from './useSensorReading';

const LIVE_COMPONENTS: NodeComponentId[] = ['ldr', 'potentiometer', 'button', 'ultrasonic'];

const LIVE_ICON: Record<string, IconName> = {
  ldr: 'sun',
  potentiometer: 'knob',
  button: 'button',
  ultrasonic: 'wave',
};

function defaultPins(componentId: NodeComponentId): Record<string, PinId> {
  const def = getComponent(componentId);
  if (!def) return {};
  const pins: Record<string, PinId> = {};
  for (const spec of def.pins) {
    const first = pinsForKinds(spec.kinds)[0];
    if (first) pins[spec.id] = first;
  }
  return pins;
}

export function LiveSensorScreen() {
  const [componentId, setComponentId] = useState<NodeComponentId>('ldr');
  const [pins, setPins] = useState<Record<string, PinId>>(() => defaultPins('ldr'));
  const [samples, setSamples] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const def: ComponentDef | undefined = getComponent(componentId);
  const hardwareStatus = useStore(hardwareStore, (state) => state.hardware);
  const simulated = useStore(hardwareStore, (state) => state.simulated);
  const remembered = useStore(lastReading, (state) => state);

  const reading = def?.reading;
  const pullup = componentId === 'button';
  const sensor = useSensorReading({ def, pins, pullup, active: true });
  const value = sensor.value;

  const range = useMemo(
    () => ({
      min: reading?.min ?? 0,
      max: reading?.max ?? 1023,
    }),
    [reading],
  );

  useEffect(() => {
    if (value === null || !Number.isFinite(value)) return;
    setSamples((previous) => [...previous.slice(-119), value]);
  }, [value]);

  useEffect(() => {
    setSamples([]);
  }, [componentId, pins]);

  const selectComponent = (next: NodeComponentId) => {
    setComponentId(next);
    setPins(defaultPins(next));
  };

  const setPin = (key: string, pin: PinId) => {
    setPins((current) => ({ ...current, [key]: pin }));
  };

  const handleUseCurrent = () => {
    if (!sensor.ok || value === null) {
      showToast('Wait for a reading first.', 'warn');
      return;
    }
    rememberReading({ componentId, pins: { ...pins }, value: Math.round(value), at: Date.now() });
    showToast(`Remembered ${Math.round(value)}${reading?.unit ?? ''}. Use it in a condition.`);
  };

  const handleMakeRule = () => {
    if (!sensor.ok || value === null) {
      showToast('Wait for a reading first.', 'warn');
      return;
    }
    const isButton = componentId === 'button';
    startRuleFromReading({
      componentId,
      pins,
      threshold: Math.round(value),
      op: isButton ? 'equalsTo' : 'lessThan',
    });
    go('flow');
    showToast(`Added ${def?.name ?? 'sensor'} and a condition. Now add an action.`);
  };

  const handleTrySimulation = async () => {
    setBusy(true);
    try {
      await api.setHardwareMode('on');
      await refreshHardware();
      showToast('Simulation is on. Values are not real.');
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleConnectArduino = async () => {
    setBusy(true);
    try {
      await connectArduino();
      await refreshHardware();
      showToast('Arduino connected.');
    } catch (error) {
      if (!(error instanceof ApiError && error.code === 'cancelled')) showError(error);
    } finally {
      setBusy(false);
    }
  };

  const handlePrepareArduino = async () => {
    setBusy(true);
    try {
      await api.installBridge();
      showToast('Preparing your Arduino...');
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const needsHardware = hardwareStatus.state !== 'ready' && !simulated;
  const canConnect = simulated && isDemoMode() && isWebSerialSupported();

  return (
    <>
      <TopBar title="Live Sensor" subtitle="See the physical world in real time">
        <HardwarePill />
      </TopBar>

      <div className="screen-body">
        <div className="live">
          <h1 className="live-heading">{def?.name ?? 'Live sensor'}</h1>
          <div className="live-parts">
            {LIVE_COMPONENTS.map((id) => {
              const itemDef = getComponent(id);
              if (!itemDef) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className={`live-part ${componentId === id ? 'live-part--active' : ''}`}
                  onClick={() => selectComponent(id)}
                >
                  <span className="node-icon node-icon--sensor">
                    <Icon name={LIVE_ICON[id] ?? 'sun'} size={18} />
                  </span>
                  <span>
                    <span className="live-part-name">{itemDef.name}</span>
                    <br />
                    <span className="live-part-sub">{itemDef.summary}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="live-pins">
            {def?.pins.map((spec) => (
              <PinPicker
                key={spec.id}
                label={componentId === 'ultrasonic' ? `PIN ${spec.label}` : 'PIN'}
                kinds={spec.kinds}
                value={pins[spec.id]}
                onChange={(pin) => setPin(spec.id, pin)}
              />
            ))}
          </div>

          <div className="live-value">
            {needsHardware ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 560 }}>
                {hardwareStatus.state === 'needs-bridge' ? (
                  <>
                    <div className="note note--info">
                      <Icon name="chip" size={18} />
                      <span>
                        Your Arduino is connected but needs ArduDeck Bridge before it can be
                        watched live.
                      </span>
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => void handlePrepareArduino()}
                      disabled={busy}
                    >
                      Prepare Arduino
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="note">
                      <Icon name="usb" size={18} />
                      <span>
                        {canConnect
                          ? 'Plug in your Arduino and let the browser ask for permission.'
                          : 'Connect your Arduino with the USB cable to see real values.'}
                      </span>
                    </div>
                    {canConnect ? (
                      <Button
                        variant="primary"
                        onClick={() => void handleConnectArduino()}
                        disabled={busy}
                      >
                        Connect Arduino
                      </Button>
                    ) : null}
                    <Button onClick={() => void handleTrySimulation()} disabled={busy}>
                      Try simulation
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="readout">
                  <span
                    className={`readout-value ${
                      componentId === 'ultrasonic' ? 'readout-value--small' : ''
                    }`}
                  >
                    {value === null || value < 0 ? '––' : Math.round(value)}
                  </span>
                  <span className="readout-unit">{reading?.unit ?? ''}</span>
                </div>
                <div className="live-meter">
                  <Meter value={sensor.ok ? value : null} min={range.min} max={range.max} />
                  <div className="meter-scale">
                    <span>{reading?.lowLabel ?? range.min}</span>
                    <span>{reading?.highLabel ?? range.max}</span>
                  </div>
                  <Sparkline samples={samples} min={range.min} max={range.max} />
                  {componentId === 'ultrasonic' && value !== null && value < 0 ? (
                    <div className="hint">No echo. Check the sensor and the wires.</div>
                  ) : null}
                </div>
              </>
            )}
          </div>

          {simulated && componentId !== 'button' ? (
            <div className="live-slider">
              <Icon name="flask" size={20} />
              <span style={{ fontWeight: 700, minWidth: 104 }}>SIMULATED</span>
              <input
                className="slider"
                type="range"
                min={range.min}
                max={range.max}
                step={reading?.kind === 'distance' ? 1 : 5}
                value={value !== null && value >= 0 ? value : range.min}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  const pin = componentId === 'ultrasonic' ? pins['trig'] : pins['signal'];
                  if (pin) void api.mockValue(pin, next).catch(() => undefined);
                }}
              />
              <span className="test-sim-value">
                {value === null || value < 0 ? '––' : Math.round(value)}
              </span>
            </div>
          ) : null}

          {simulated && componentId === 'button' ? (
            <div className="live-slider">
              <Icon name="flask" size={20} />
              <span style={{ fontWeight: 700 }}>SIMULATED</span>
              <Button
                size="sm"
                onClick={() => {
                  const pin = pins['signal'];
                  if (pin) void api.mockValue(pin, 1).catch(() => undefined);
                }}
              >
                Press
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const pin = pins['signal'];
                  if (pin) void api.mockValue(pin, 0).catch(() => undefined);
                }}
              >
                Release
              </Button>
            </div>
          ) : null}

          <div className="live-actions">
            <Button
              variant="primary"
              size="lg"
              className="btn--grow"
              icon="check"
              onClick={handleUseCurrent}
              disabled={!sensor.ok}
            >
              USE THIS VALUE
            </Button>
            <Button
              size="lg"
              className="btn--grow"
              icon="layers"
              onClick={handleMakeRule}
              disabled={!sensor.ok}
            >
              MAKE A RULE
            </Button>
          </div>

          {remembered ? (
            <div className="hint">
              Remembered reading: {Math.round(remembered.value)} (
              {getComponent(remembered.componentId)?.name ?? 'sensor'})
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
