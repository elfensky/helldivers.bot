'use client';
import { useRef } from 'react';
import Map from '@/components/h1/Galaxy/Map';
import Tooltip from '@/components/h1/Galaxy/Tooltip';

export default function Galaxy({ mapState }) {
    const svgRef = useRef(null);

    return (
        <section id="galaxy" className="flex flex-col gap-4 w-full h-full">
            <Map svgRef={svgRef} map={mapState} />
            <Tooltip svgRef={svgRef} map={mapState} />
        </section>
    );
}
