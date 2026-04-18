"use client";

import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  sectionName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error in ${this.props.sectionName || 'component'}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="glass-card-static p-8 border-2 border-[--danger]/20">
          <div className="flex flex-col items-center justify-center text-center gap-4">
            <div className="text-4xl">⚠️</div>
            <h3 className="text-lg font-black text-[--danger]">
              {this.props.sectionName ? `${this.props.sectionName} Error` : 'Something went wrong'}
            </h3>
            <p className="text-sm text-[--text-muted] max-w-md">
              {this.state.error?.message || 'An unexpected error occurred in this section.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="btn-secondary mt-4"
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
