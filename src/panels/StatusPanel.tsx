
import { t } from '../i18n';
import { usePolled, useUi } from '../state/store';

export function StatusPanel() {
  const ui = useUi();
  const samples = usePolled((e) => e.accumSamples(), 200);
  const frameMs = usePolled((e) => e.frameMs(), 200);
  const stats = ui.sceneStats;
  const kv = (k: string, v: string) => (
    <div className="pt-kv" key={k}><span className="pt-k">{k}</span><span className="pt-v">{v}</span></div>
  );
  return (
    <section className="pt-panel">
      <h2>{t('panel.status')}</h2>
      {kv(t('stat.scene'), ui.sceneName)}
      {stats
        ? <>
            {kv(t('stat.triangles'), String(stats.triCount))}
            {kv(t('stat.nodes'), String(stats.nodeCount))}
            {kv(t('stat.maxDepth'), String(stats.maxDepth))}
            {kv(t('stat.buildMs'), `${stats.buildMs.toFixed(0)} ms`)}
          </>
        : kv(t('stat.triangles'), '—')}
      {kv(t('stat.samples'), String(samples))}
      {kv(t('stat.frameMs'), frameMs.toFixed(1))}
    </section>
  );
}
