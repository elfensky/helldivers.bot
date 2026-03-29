'use client';
import { useRef } from 'react';
import Map from '@/components/h1/Galaxy/Map';
import Tooltip from '@/components/h1/Galaxy/Tooltip';

export default function Galaxy({ mapState }) {
    const svgRef = useRef(null);

    return (
        <section
            id="galaxy"
            className="mx-4 mb-4 flex flex-grow-[4] flex-col items-center gap-4 sm:mx-0 md:mx-auto md:max-w-[480px] lg:mx-0 lg:max-w-none"
        >
            <Map svgRef={svgRef} map={mapState} />
            <Tooltip svgRef={svgRef} map={mapState} />
        </section>
    );
}
