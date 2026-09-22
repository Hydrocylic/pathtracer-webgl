
import { useLocale, t } from './i18n';
import { useUi } from './state/store';
import { ScenePanel } from './panels/ScenePanel';
import { ParamPanel } from './panels/ParamPanel';
import { DebugPanel } from './panels/DebugPanel';
import { CameraPanel } from './panels/CameraPanel';
import { StatusPanel } from './panels/StatusPanel';
import { EnvPanel } from './panels/EnvPanel';

export function App() {
  const ui = useUi();
  useLocale();
  if (ui.uiHidden) return null;
  return (
    <div className="pt-panels">
      { }
      {ui.loading && (
        <section className="pt-panel">
          <p className="pt-loading">{t('ui.loading', { scene: ui.loadingScene ?? '…' })}</p>
        </section>
      )}
      <ScenePanel />
      <ParamPanel />
      <DebugPanel />
      <CameraPanel />
      <StatusPanel />
      <EnvPanel />
    </div>
  );
}
