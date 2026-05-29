import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-surface-950 flex items-center justify-center p-6">
          <div className="bg-surface-900 border border-surface-800 rounded-xl p-6 max-w-md w-full text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <span className="text-lg" style={{ color: '#ef4444' }}>!</span>
            </div>
            <h2 className="text-sm font-semibold mb-1" style={{ color: '#f4f4f5' }}>Something went wrong</h2>
            <p className="text-[11px] mb-4 leading-relaxed" style={{ color: '#71717a' }}>
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 text-xs font-medium bg-blue-500/20 hover:bg-blue-500/30 rounded transition-colors"
              style={{ color: '#60a5fa' }}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
