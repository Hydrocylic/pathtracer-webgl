
import { DEBUG_MODES } from '@core/debug/debug-modes.js';
import { t, type MessageKey } from '../i18n';
import { getEngine, useUi } from '../state/store';

const DEBUG_LABEL_KEYS: Record<number, MessageKey> = {
  0: 'debug.rendered',
  1: 'debug.normals',
  2: 'debug.albedo',
  3: 'debug.hitDistance',
  4: 'debug.escape',
  5: 'debug.traversalHeatmap',
};

export function DebugPanel() {
  const ui = useUi();
  const engine = getEngine();
  return (
    <section className="pt-panel">
      <h2>{t('panel.debug')}</h2>
      <div className="pt-row">
        <label htmlFor="pt-debug">{t('label.debugMode')}</label>
        <select id="pt-debug" value={ui.debugMode} onChange={(e) => engine.setParam('debugMode', Number(e.target.value))}>
          {DEBUG_MODES.map((m) => (
            <option key={m.value} value={m.value}>{t(DEBUG_LABEL_KEYS[m.value])}</option>
          ))}
        </select>
      </div>
    </section>
  );
}
