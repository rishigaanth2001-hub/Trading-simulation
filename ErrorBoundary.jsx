import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-3xl border border-red-600 bg-red-950/80 p-6 text-red-200">
          <h3 className="text-lg font-semibold">Component failed to render</h3>
          <p className="mt-2 text-sm text-red-200">{this.props.fallback || 'Something went wrong in this section.'}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
