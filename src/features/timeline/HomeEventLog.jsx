'use client';

import EventLog from '@/features/timeline/EventLog';
import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';

/**
 * Thin wrapper that feeds the homepage's live polling data into the
 * shared `EventLog` component with `timeFormat="live"`. Kept as a
 * separate file because `page.jsx` is a server component and must not
 * call `useLiveDataContext` directly.
 */
export default function HomeEventLog() {
    const { data } = useLiveDataContext();
    return <EventLog events={data?.events ?? []} timeFormat="live" id="event-log" />;
}
