import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/flow.css';
import { App } from './app/App';
import { startHardwareSync } from './state/hardware';

startHardwareSync();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Ardu OS root element is missing');
}

createRoot(container).render(<App />);
