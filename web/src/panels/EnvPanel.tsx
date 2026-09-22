
import { useState } from 'react';
import { t } from '../i18n';
import { getEngine } from '../state/store';

export function EnvPanel() {
  const engine = getEngine();
  const [info, setInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const collect = () => {
    const s = engine.collectEnvInfo();
    setInfo(s);
    setCopied(false);
    console.log(s);
    navigator.clipboard?.writeText(s).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <section className="pt-panel">
      <h2>{t('panel.environment')}</h2>
      <button type="button" onClick={collect}>{info ? t('btn.recollect') : t('btn.collect')}</button>
      {copied && <p className="pt-hint">{t('hint.copied')}</p>}
      {info && <pre className="pt-pre">{info}</pre>}
    </section>
  );
}
