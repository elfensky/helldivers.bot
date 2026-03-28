'use client';
import { useRef } from 'react';
import Map from '@/components/h1/Galaxy/Map';
import Tooltip from '@/components/h1/Galaxy/Tooltip';
import { formatTimeAgo } from '@/utils/formatTimeAgo.mjs';

export default function Galaxy({ mapState, lastUpdated, live }) {
    const svgRef = useRef(null);
    const timeAgo = formatTimeAgo(lastUpdated);

    return (
        <section
            id="galaxy"
            className="mx-4 mb-4 flex flex-grow-[4] flex-col items-center gap-4 sm:mx-0"
        >
            <Map svgRef={svgRef} map={mapState} live={live} />
            {timeAgo && (
                <p
                    className="text-center font-mono text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                >
                    {timeAgo}
                </p>
            )}
            <Tooltip svgRef={svgRef} map={mapState} />
        </section>
    );
}
