'use client';
import { useRef, memo } from 'react';
import Map from '@/components/h1/Galaxy/Map';
import Tooltip from '@/components/h1/Galaxy/Tooltip';

export default memo(function Galaxy({ mapState }) {
    const svgRef = useRef(null);

    return (
        <section
            id="galaxy"
            className="mx-4 mb-4 flex flex-grow-[4] flex-col items-center gap-4 sm:mx-0"
        >
            <Map svgRef={svgRef} map={mapState} />
            <Tooltip svgRef={svgRef} map={mapState} />
        </section>
    );
});
