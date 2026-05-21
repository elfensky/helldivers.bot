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
 * @param {{initialData: object | null, initialMapState: object | null, children: React.ReactNode}} props - Component props
 */
export default function LiveDataProvider({ initialData, initialMapState, children }) {
    const { data, mapState, status, prevData, isLeader } = useLiveData(
        initialData,
        initialMapState,
    );

    return (
        <LiveDataContext.Provider value={{ data, mapState, status, prevData, isLeader }}>
            <LiveToasts prevData={prevData} data={data} isLeader={isLeader} />
            {children}
        </LiveDataContext.Provider>
    );
}
