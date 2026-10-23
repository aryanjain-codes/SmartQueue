import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SmartQueue ErrorBoundary] Caught render error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant p-6 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-xl bg-error-container text-error flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-3xl">error_outline</span>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-primary tracking-tight">
                {this.props.fallbackTitle || 'Display Interruption'}
              </h2>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                SmartQueue encountered an unexpected rendering condition while displaying this view.
                Data persistence and security tokens remain safe on the server.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-surface-container-low p-3 rounded-lg border border-outline-variant/60 font-mono text-[11px] text-error overflow-x-auto max-h-28">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-container transition-all shadow-xs flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                <span>Try Again</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 py-2.5 px-4 bg-surface-container text-primary rounded-lg text-xs font-semibold hover:bg-surface-container-high transition-all border border-outline-variant flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">home</span>
                <span>Return to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
