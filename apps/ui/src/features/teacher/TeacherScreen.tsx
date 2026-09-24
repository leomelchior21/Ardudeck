import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { TeacherSystem } from '../../services/types';
import { refreshHardware } from '../../state/hardware';
import { go } from '../../state/navigation';
import { showError, showToast } from '../../state/toast';
import { Button } from '../../ui/Button';
import { HardwarePill, Pill } from '../../ui/Pill';
import { TopBar } from '../../ui/TopBar';

type LogKind = 'app' | 'serial' | 'compile' | 'events';

const LOG_TABS: { id: LogKind; label: string }[] = [
  { id: 'app', label: 'APP' },
  { id: 'serial', label: 'SERIAL' },
  { id: 'compile', label: 'UPLOAD' },
  { id: 'events', label: 'EVENTS' },
];

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="kv">
      <div className="kv-key">{label}</div>
      <div className="kv-value">{value}</div>
    </div>
  );
}

export function TeacherScreen() {
  const [system, setSystem] = useState<TeacherSystem | null>(null);
  const [logKind, setLogKind] = useState<LogKind>('app');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.teacherSystem();
      setSystem(result.system);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not read the system.');
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const result = await api.teacherLogs(logKind, 150);
      setLogs(result.lines);
    } catch {
      setLogs([]);
    }
  }, [logKind]);

  useEffect(() => {
    void load();
    void loadLogs();
    const timer = window.setInterval(() => {
      void load();
      void loadLogs();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [load, loadLogs]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      showToast(success);
      await load();
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(false);
    }
  };

  const hardware = system?.hardware.hardware;
  const devices = system?.hardware.devices ?? [];
  const platform = system?.platform ?? {};
  const memory = system?.memory;

  return (
    <>
      <TopBar title="Teacher Mode" subtitle="Developer and maintenance view" onBack={() => go('home')}>
        <HardwarePill />
        <Button variant="quiet" icon="refresh" onClick={() => void load()} aria-label="Refresh" />
      </TopBar>

      <div className="screen-body screen-body--scroll">
        <div className="teacher">
          {error ? (
            <div className="note note--danger">
              <span>{error}</span>
            </div>
          ) : null}

          <div className="section-title">Hardware</div>
          <div className="teacher-grid">
            <KeyValue label="State" value={hardware?.state ?? '-'} />
            <KeyValue label="Board" value={hardware?.board ?? '-'} />
            <KeyValue label="Serial device" value={hardware?.port ?? '-'} />
            <KeyValue label="Source" value={hardware?.source ?? '-'} />
            <KeyValue label="Detail" value={hardware?.detail ?? '-'} />
            <KeyValue label="Web clients" value={system ? String(system.webClients) : '-'} />
          </div>

          {devices.length > 0 ? (
            <>
              <div className="section-title">Serial devices</div>
              {devices.map((device) => (
                <div key={device.port} className="project-row">
                  <div className="project-main" style={{ cursor: 'default' }}>
                    <span className="project-name">{device.port}</span>
                    <span className="project-meta">
                      {device.label}
                      {device.vid_pid ? ` · ${device.vid_pid}` : ''}
                      {device.is_candidate ? '' : ' · not an Arduino by default'}
                    </span>
                  </div>
                  {hardware?.port === device.port ? <span className="pill pill--ok">IN USE</span> : null}
                  <Button
                    size="sm"
                    icon="usb"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api.useHardware(device.port);
                        await refreshHardware();
                      }, `Using ${device.port}.`)
                    }
                  >
                    Use
                  </Button>
                </div>
              ))}
            </>
          ) : null}

          <div className="section-title">Arduino tools</div>
          <div className="teacher-grid">
            <KeyValue label="arduino-cli" value={system?.arduinoCli.version ?? 'not installed'} />
            <KeyValue label="Executable" value={system?.arduinoCli.executable ?? '-'} />
            <KeyValue
              label="AVR core"
              value={system?.arduinoCli.avrCore ? 'installed' : 'missing'}
            />
            <KeyValue label="FQBN" value={system?.app.fqbn ?? '-'} />
            <KeyValue
              label="Bridge sketch"
              value={system?.bridge.present ? 'present' : 'missing'}
            />
            <KeyValue label="App version" value={system?.app.version ?? '-'} />
          </div>

          <div className="section-title">Raspberry Pi</div>
          <div className="teacher-grid">
            <KeyValue label="Model" value={system?.piModel ?? (platform.system as string) ?? '-'} />
            <KeyValue
              label="Memory"
              value={memory ? `${memory.availableMb} / ${memory.totalMb} MB free` : '-'}
            />
            <KeyValue
              label="Temperature"
              value={system?.temperatureC ? `${system.temperatureC.toFixed(1)} °C` : '-'}
            />
            <KeyValue
              label="Disk"
              value={system?.disk ? `${system.disk.freeMb} MB free` : '-'}
            />
            <KeyValue label="Python" value={String(platform.python ?? '-')} />
            <KeyValue label="Host" value={String(platform.hostname ?? '-')} />
          </div>

          <div className="section-title">Actions</div>
          <div className="live-actions" style={{ flexWrap: 'wrap' }}>
            <Button
              icon="chip"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api.installBridge();
                  showToast('Installing ArduDeck Bridge...');
                }, 'Bridge installation started.')
              }
            >
              Reinstall bridge firmware
            </Button>
            <Button
              icon="usb"
              disabled={busy}
              onClick={() => void run(async () => api.reconnectHardware(), 'Reconnecting...')}
            >
              Reconnect Arduino
            </Button>
            <Button
              icon="flask"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const simulated = system?.hardware.simulated ?? false;
                  await api.setHardwareMode(simulated ? 'off' : 'on');
                  await refreshHardware();
                }, 'Hardware mode changed.')
              }
            >
              {system?.hardware.simulated ? 'Use real hardware' : 'Use simulation'}
            </Button>
            <Button
              icon="refresh"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await api.teacherRestart();
                  showToast(result.message, result.ok ? 'info' : 'warn');
                }, '')
              }
            >
              Restart backend
            </Button>
          </div>

          <div className="section-title">
            Logs
            {system?.deploy ? (
              <Pill tone={system.deploy.status === 'ok' ? 'ok' : system.deploy.status === 'error' ? 'danger' : 'accent'}>
                last upload: {system.deploy.status}
              </Pill>
            ) : null}
          </div>
          <div className="tray-tabs">
            {LOG_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`tray-tab ${logKind === tab.id ? 'tray-tab--active' : ''}`}
                onClick={() => setLogKind(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="log-view">{logs.length > 0 ? logs.join('\n') : 'No entries yet.'}</div>

          <div className="hint">
            Teacher Mode is for maintenance. Students never need it. Hold the ArduDeck mark on the
            Home screen to open it.
          </div>
        </div>
      </div>
    </>
  );
}
