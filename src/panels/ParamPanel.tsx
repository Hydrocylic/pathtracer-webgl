
import { t } from '../i18n';
import { getEngine, useUi } from '../state/store';

export function ParamPanel() {
  const ui = useUi();
  const engine = getEngine();
  const bg = ui.background;
  return (
    <section className="pt-panel">
      <h2>{t('panel.parameters')}</h2>
      <div className="pt-row">
        <label htmlFor="pt-spp">{t('label.spp')}</label>
        <input
          id="pt-spp" type="number" min={1} max={64} step={1} value={ui.spp}
          onChange={(e) => engine.setParam('spp', Number(e.target.value))}
        />
      </div>
      <div className="pt-row">
        <label htmlFor="pt-bvh">{t('label.bvh')}</label>
        <select id="pt-bvh" value={ui.useBvh} onChange={(e) => engine.setParam('useBvh', Number(e.target.value))}>
          <option value={1}>{t('opt.bvh')}</option>
          <option value={0}>{t('opt.linear')}</option>
        </select>
      </div>
      <div className="pt-row">
        <label htmlFor="pt-nee">{t('label.nee')}</label>
        <select id="pt-nee" value={ui.useNee} onChange={(e) => engine.setParam('useNee', Number(e.target.value))}>
          <option value={1}>{t('opt.nee')}</option>
          <option value={0}>{t('opt.random')}</option>
        </select>
      </div>
      <h3>{t('section.background')}</h3>
      {([['bgR', 'bg.r', bg[0]], ['bgG', 'bg.g', bg[1]], ['bgB', 'bg.b', bg[2]]] as const).map(([key, label, value]) => (
        <div className="pt-row" key={key}>
          <label htmlFor={`pt-${key}`}>{label}</label>
          <input
            id={`pt-${key}`} type="range" min={0} max={1} step={0.01} value={value}
            onChange={(e) => engine.setParam(key, Number(e.target.value))}
          />
        </div>
      ))}
      <h3>{t('section.constants')}</h3>
      <div className="pt-kv"><span className="pt-k">{t('label.maxBounces')}</span><span className="pt-v">{t('value.readOnly')}</span></div>
    </section>
  );
}
