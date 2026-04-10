'use client';
import Map from '@/features/galaxy/Map';

export default function Galaxy({ mapState, pulseDelays }) {
    return (
        <section id="galaxy" className="flex h-full w-full flex-col gap-4">
            <Map map={mapState} pulseDelays={pulseDelays} />
        </section>
    );
}
