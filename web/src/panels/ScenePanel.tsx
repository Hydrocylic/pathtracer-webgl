
import { setLocale, t, useLocale } from '../i18n';
import { getEngine, useUi } from '../state/store';

export function ScenePanel() {
  const ui = useUi();
  const engine = getEngine();
  const locale = useLocale();
  return (
    <section className="pt-panel">
      <div className="pt-head">
        <h2>webgl-path-tracer</h2>
        <select
          className="pt-locale" value={locale} aria-label="Language / 语言"
          onChange={(e) => setLocale(e.target.value === 'en' ? 'en' : 'zh')}
        >
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      </div>
      <div className="pt-row">
        <label htmlFor="pt-scene">{t('label.scene')}</label>
        <select id="pt-scene" value={ui.sceneName} onChange={(e) => engine.setScene(e.target.value)}>
          {ui.sceneList.map(({ name, ready, lazy }) => (
            <option key={name} value={name} disabled={!ready && !lazy}>
              {name}
              {ready ? '' : lazy ? t('opt.onDemand') : t('opt.loading')}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
