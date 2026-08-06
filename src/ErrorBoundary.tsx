import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

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
      return (
        <div className="full-loader">
          <div style={{ textAlign: 'center', padding: '0 24px', maxWidth: 320 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Algo falló al cargar Calivia.</p>
            <p style={{ fontSize: 13, color: 'var(--text-soft)', margin: '0 0 16px' }}>{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ padding: '10px 18px', border: 'none', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Recargar
            </button>
          </div>
          <style>{`.full-loader { min-height: 100vh; display: grid; place-items: center; background: var(--bg); }`}</style>
        </div>
      );
    }
    return this.props.children;
  }
}
