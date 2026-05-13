import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen rtl flex items-center justify-center bg-zinc-950 text-zinc-100 p-4">
          <div className="max-w-md w-full glass rounded-3xl p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-zinc-100">حدث خطأ غير متوقع</h1>
              <p className="text-zinc-400 text-sm">
                {this.state.error?.message || 'عذراً، واجهنا مشكلة أثناء تحميل الصفحة.'}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-500/90 text-zinc-950 font-bold py-3 px-4 rounded-xl transition-colors"
            >
              <RefreshCcw className="w-5 h-5" />
              <span>تحديث الصفحة</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
