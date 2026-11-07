import { useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useT, type Strings } from './lib/i18n';

const strings: Strings = {
  es: {
    title: 'Sin conexión',
    body: 'No pudimos conectar con Calivia. Tu sesión sigue guardada.',
    emergency: 'Si estás en peligro, llama ahora a los servicios de emergencia de tu país.',
    retry: 'Reintentar',
    retrying: 'Conectando…',
  },
  en: {
    title: 'No connection',
    body: "We couldn't reach Calivia. Your session is still saved.",
    emergency: "If you are in danger, call your country's emergency services now.",
    retry: 'Try again',
    retrying: 'Connecting…',
  },
  pt: {
    title: 'Sem conexão',
    body: 'Não conseguimos conectar ao Calivia. Sua sessão continua salva.',
    emergency: 'Se você está em perigo, ligue agora para os serviços de emergência do seu país.',
    retry: 'Tentar novamente',
    retrying: 'Conectando…',
  },
};

interface Props {
  onRetry: () => Promise<void>;
}

export default function OfflineScreen({ onRetry }: Props) {
  const t = useT(strings);
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="offline-screen">
      <WifiOff size={32} strokeWidth={1.8} />
      <h1>{t('title')}</h1>
      <p>{t('body')}</p>
      <p className="offline-emergency">{t('emergency')}</p>
      <button type="button" onClick={retry} disabled={retrying}>
        {retrying ? t('retrying') : t('retry')}
      </button>
      <style>{`
        .offline-screen {
          min-height: 100vh; min-height: 100dvh;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 10px; padding: 24px; text-align: center;
          background: var(--bg); color: var(--text);
        }
        .offline-screen h1 { margin: 6px 0 0; font-size: 20px; }
        .offline-screen p { margin: 0; max-width: 320px; font-size: 14px; line-height: 1.5; color: var(--text-soft); }
        .offline-screen .offline-emergency { font-weight: 700; color: var(--text); }
        .offline-screen button {
          margin-top: 10px; padding: 12px 22px; border: none; border-radius: 999px;
          background: var(--primary); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
        }
        .offline-screen button:disabled { opacity: 0.6; cursor: default; }
      `}</style>
    </div>
  );
}
