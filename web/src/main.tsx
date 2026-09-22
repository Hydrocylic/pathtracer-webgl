import { createRoot } from 'react-dom/client';
import { PathTracerEngine } from './engine/PathTracerEngine';
import { bindEngine } from './state/store';
import { App } from './App';
import './panels/panels.css';

const engine = new PathTracerEngine();
bindEngine(engine);

const container = document.querySelector('#pane-container');
if (container) {
  createRoot(container).render(<App />);
}
