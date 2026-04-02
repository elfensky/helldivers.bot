'use client';
import Map from '@/components/h1/Galaxy/Map';

export default function Galaxy({ mapState }) {
    return (
        <section id="galaxy" className="flex flex-col gap-4 w-full h-full">
            <Map map={mapState} />
        </section>
    );
}
