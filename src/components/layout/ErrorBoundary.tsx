import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  /** Cambia al navegar para limpiar el error al ir a otra pantalla. */
  resetKey?: string;
  /** Versión a pantalla completa (fuera del layout). */
  fullScreen?: boolean;
}

interface State {
  error: Error | null;
}

/**
 * Atrapa errores de render para que una falla en un módulo no deje la app en
 * blanco: muestra un aviso con opción de reintentar o recargar.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error de render atrapado:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={this.props.fullScreen ? 'min-h-screen flex items-center justify-center p-6 bg-[var(--color-app-bg)]' : 'py-16 flex justify-center'}>
        <div className="max-w-md text-center space-y-3">
          <div className="mx-auto h-11 w-11 rounded-full bg-[var(--color-app-danger-soft)] flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-[var(--color-app-danger)]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-app-text)]">Algo salió mal en esta pantalla</h2>
          <p className="text-sm text-[var(--color-app-text-muted)]">
            El resto de la app sigue funcionando. Intenta de nuevo; si se repite, recarga la página.
          </p>
          <p className="text-xs font-mono text-[var(--color-app-text-subtle)] break-words">{this.state.error.message}</p>
          <div className="flex justify-center gap-2 pt-1">
            <Button variant="outline" onClick={() => this.setState({ error: null })}>Reintentar</Button>
            <Button onClick={() => window.location.reload()}>
              <RotateCcw className="h-4 w-4 mr-1.5" /> Recargar
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
