'use client';
import { useRef } from 'react';
import Map from '@/components/h1/Galaxy/Map';
import Tooltip from '@/components/h1/Galaxy/Tooltip';

export default function Galaxy({ mapState }) {
    const svgRef = useRef(null);

    return (
        <section id="galaxy" className="mb-4 flex flex-col items-center gap-4">
            <Map svgRef={svgRef} map={mapState} />
            <Tooltip svgRef={svgRef} map={mapState} />
        </section>
    );
}
