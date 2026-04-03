'use client';
import Map from '@/components/h1/Galaxy/Map';

export default function Galaxy({ mapState }) {
    return (
        <section id="galaxy" className="flex h-full w-full flex-col gap-4">
            <Map map={mapState} />
        </section>
    );
}
