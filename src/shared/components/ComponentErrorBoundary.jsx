'use client';

import { Component } from 'react';
import Button from '@/shared/components/Button/Button';

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
                    <div className="flex flex-col items-center gap-2 text-center">
                        <p className="text-sm text-text-muted">
                            {this.props.name ?? 'Section'} failed to load
                        </p>
                        <Button onClick={() => this.setState({ hasError: false })}>
                            Retry
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
