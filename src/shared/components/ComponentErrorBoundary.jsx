'use client';

import { Component } from 'react';

export default class ComponentErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center border border-danger/30 bg-surface-1 p-6">
                    <div className="text-center">
                        <p className="text-sm text-text-muted">
                            {this.props.name ?? 'Section'} failed to load
                        </p>
                        <button
                            onClick={() => this.setState({ hasError: false })}
                            className="mt-2 cursor-pointer text-xs text-primary hover:underline"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
