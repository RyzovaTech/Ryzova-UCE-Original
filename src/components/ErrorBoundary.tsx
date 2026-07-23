import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

const FRIENDLY_MESSAGES: Array<{ test: RegExp; message: string }> = [
  { test: /out of memory|heap|allocation/i, message: 'The browser ran out of memory while analyzing a large archive. Try a smaller project or close other tabs.' },
  { test: /quota|storage/i, message: 'Browser storage is full. Clear some saved reports in Settings and try again.' },
  { test: /zip|archive|extract/i, message: 'The archive could not be processed. It may be corrupted or password-protected.' },
  { test: /network|fetch|offline/i, message: 'A network issue occurred. UCE runs locally — check your browser connection and reload.' },
];

function humanizeError(error: Error): string {
  const raw = error.message || '';
  for (const { test, message } of FRIENDLY_MESSAGES) {
    if (test.test(raw)) return message;
  }
  if (raw && raw.length < 200) return raw;
  return 'An unexpected error occurred while analyzing the project. Reload the page and try again.';
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: humanizeError(error) };
  }

  componentDidCatch(error: Error) {
    // Never log raw stack traces to the console in production — only a sanitized breadcrumb.
    console.warn('[UCE] Analysis error recovered:', humanizeError(error));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6" role="alert" aria-live="assertive">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              {this.state.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
