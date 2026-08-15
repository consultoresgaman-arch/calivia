import { Component, type ErrorInfo, type ReactNode } from 'react';
import { detectLanguage } from './lib/i18n/languages';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// No usa el hook useT: un ErrorBoundary debe seguir funcionando aunque el
// árbol de contexto (incluido LanguageProvider) sea la causa del fallo.
const MESSAGES = {
  es: { title: 'Algo falló al cargar Calivia.', reload: 'Recargar' },
  en: { title: 'Something went wrong loading Calivia.', reload: 'Reload' },
  pt: { title: 'Algo falhou ao carregar o Calivia.', reload: 'Recarregar' },
} as const;

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Calivia] Error no capturado en el árbol de la app:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const m = MESSAGES[detectLanguage()];
      return (
        <div className="full-loader">
          <div style={{ textAlign: 'center', padding: '0 24px', maxWidth: 320 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>{m.title}</p>
            <p style={{ fontSize: 13, color: 'var(--text-soft)', margin: '0 0 16px' }}>{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ padding: '10px 18px', border: 'none', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              {m.reload}
            </button>
          </div>
          <style>{`.full-loader { min-height: 100vh; display: grid; place-items: center; background: var(--bg); }`}</style>
        </div>
      );
    }
    return this.props.children;
  }
}
