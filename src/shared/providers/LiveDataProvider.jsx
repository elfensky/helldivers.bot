'use client';
import { LiveDataContext } from './LiveDataContext.mjs';
import { useLiveData } from '@/shared/hooks/useLiveData.mjs';
import LiveToasts from '@/features/notifications/LiveToasts';

/**
 * App-wide live data provider. Wraps children with SSE campaign data
 * via React Context so any page can access live state and receive
 * toast notifications.
 *
 * Must be rendered from a client component boundary (not a server
 * component) so that LiveToasts and the Sonner Toaster share the
 * same module singleton.
 *
 * Data comes exclusively from SSE (with localStorage fallback for
 * offline/PWA). No server-rendered initial data — this keeps the
 * RSC Flight stream free of large campaign payloads.
 */
export default function LiveDataProvider({ children }) {
    const { data, mapState, status, prevData, isLeader } = useLiveData();

    return (
        <LiveDataContext.Provider value={{ data, mapState, status, prevData, isLeader }}>
            <LiveToasts prevData={prevData} data={data} isLeader={isLeader} />
            {children}
        </LiveDataContext.Provider>
    );
}
