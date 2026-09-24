import { useEffect } from 'react';
import { go, navigation } from '../state/navigation';
import { startLiveValuesSync } from '../state/liveValues';
import { initAutosave } from '../state/project';
import { useStore } from '../state/store';
import { startTelemetrySync } from '../state/telemetry';
import { Toaster } from '../ui/Toaster';
import { BootScreen } from '../features/boot/BootScreen';
import { CodeScreen } from '../features/code/CodeScreen';
import { DeployScreen } from '../features/deploy/DeployScreen';
import { FlowScreen } from '../features/flow/FlowScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { LearnScreen } from '../features/learn/LearnScreen';
import { LiveSensorScreen } from '../features/live/LiveSensorScreen';
import { ArduOsScreen } from '../features/os/ArduOsScreen';
import { ArduQuestScreen, ArduWorldScreen } from '../features/os/PreviewApps';
import { ProjectsScreen } from '../features/projects/ProjectsScreen';
import { TeacherScreen } from '../features/teacher/TeacherScreen';
import { TestLiveScreen } from '../features/test/TestLiveScreen';

function Screen({ name }: { name: string }) {
  switch (name) {
    case 'boot':
      return <BootScreen />;
    case 'os':
      return <ArduOsScreen />;
    case 'home':
      return <HomeScreen />;
    case 'learn':
      return <LearnScreen />;
    case 'live':
      return <LiveSensorScreen />;
    case 'flow':
      return <FlowScreen />;
    case 'test':
      return <TestLiveScreen />;
    case 'deploy':
      return <DeployScreen />;
    case 'code':
      return <CodeScreen />;
    case 'projects':
      return <ProjectsScreen />;
    case 'teacher':
      return <TeacherScreen />;
    case 'world':
      return <ArduWorldScreen />;
    case 'quest':
      return <ArduQuestScreen />;
    default:
      go('os');
      return null;
  }
}

export function App() {
  const screen = useStore(navigation, (state) => state.screen);

  useEffect(() => {
    initAutosave();
    startTelemetrySync();
    startLiveValuesSync();
  }, []);

  return (
    <div className="app">
      <Screen name={screen} />
      <Toaster />
    </div>
  );
}
