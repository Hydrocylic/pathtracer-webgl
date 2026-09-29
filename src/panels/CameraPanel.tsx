
import type { ChangeEvent } from 'react';
import { t } from '../i18n';
import { getEngine, useUi } from '../state/store';

type AxisKey = 'px' | 'py' | 'pz' | 'tx' | 'ty' | 'tz';

export function CameraPanel() {
  const ui = useUi();
  const engine = getEngine();
  const cam = ui.camera;

  const onAxis = (key: AxisKey) => (e: ChangeEvent<HTMLInputElement>) => {
    engine.setCameraAxis(key, Number(e.target.value));
  };

  const fmt4 = (v: number) => Number(v.toPrecision(4));
  const outputCamera = () => {
    console.log(`position: [${[fmt4(cam.px), fmt4(cam.py), fmt4(cam.pz)].join(', ')}],`);
    console.log(`target: [${[fmt4(cam.tx), fmt4(cam.ty), fmt4(cam.tz)].join(', ')}],`);
  };

  const axis = (key: AxisKey, label: string) => (
    <div className="pt-row" key={key}>
      <label htmlFor={`pt-cam-${key}`}>{label}</label>
      {/* step 0.001: 最小绝对步长（BUG-009/010——固定步长是绝对常数，极小场景下步进会跳过整个模型） */}
      <input
        id={`pt-cam-${key}`} type="number" step={0.001} value={cam[key]}
        onChange={onAxis(key)}
      />
    </div>
  );

  return (
    <section className="pt-panel">
      <h2>{t('panel.camera')}</h2>
      <h3>position</h3>
      {axis('px', 'x')}{axis('py', 'y')}{axis('pz', 'z')}
      <h3>target</h3>
      {axis('tx', 'x')}{axis('ty', 'y')}{axis('tz', 'z')}
      <div className="pt-kv"><span className="pt-k">{t('label.fov')}</span><span className="pt-v">{cam.fov.toFixed(1)}°</span></div>
      <button type="button" onClick={outputCamera}>{t('btn.outputCamera')}</button>
    </section>
  );
}
