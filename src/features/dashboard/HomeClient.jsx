'use client';

import { useRef } from 'react';
import ComponentErrorBoundary from '@/shared/components/ComponentErrorBoundary';
import DashboardClient from '@/features/dashboard/DashboardClient';
import HomeScrollytelling from '@/features/dashboard/HomeScrollytelling';

/**
 * Client wrapper for the homepage. Owns the hero ref that drives the
 * scrollytelling map's pinned state. Kept separate from `app/page.jsx`
 * so that page stays a server component and preserves its `metadata`
 * export + JSON-LD structured data.
 */
export default function HomeClient() {
    const heroRef = useRef(null);

    return (
        <>
            <div ref={heroRef}>
                <ComponentErrorBoundary name="Dashboard">
                    <DashboardClient />
                </ComponentErrorBoundary>
            </div>
            <ComponentErrorBoundary name="Event Log">
                <HomeScrollytelling heroRef={heroRef} />
            </ComponentErrorBoundary>
        </>
    );
}
