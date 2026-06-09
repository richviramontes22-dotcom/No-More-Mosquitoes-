import { Component, type ReactNode, type ErrorInfo } from "react";
import { captureClientException } from "@/lib/sentry";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

/**
 * React Error Boundary — catches render-time errors in the component tree.
 *
 * Captures to Sentry (no-op if Sentry not configured).
 * Shows a user-friendly recovery UI.
 * Never exposes stack traces or internal details to the user.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): State {
    const errorId = Math.random().toString(36).slice(2, 10).toUpperCase();
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureClientException(error, {
      componentStack: info.componentStack,
      context: this.props.context || "unknown",
      errorId: this.state.errorId,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorId: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-red-50 p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-red-100 text-red-600 mx-auto">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-900">Something went wrong</h2>
            <p className="text-sm text-red-700 mt-1">
              An unexpected error occurred. Our team has been notified.
            </p>
          </div>
          {this.state.errorId && (
            <p className="text-xs text-red-500 font-mono">
              Error ID: {this.state.errorId}
            </p>
          )}
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-semibold rounded-xl border border-red-300 text-red-700 hover:bg-red-100 transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
