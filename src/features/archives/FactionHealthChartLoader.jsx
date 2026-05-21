'use client';

import dynamic from 'next/dynamic';

// Lazy-loads the recharts-backed FactionHealthChart so its ~50KB (gzipped) of
// chart code stays out of the /archives initial bundle — the chart only
// matters once a season has snapshot data. Mirrors ProgressExplainerLoader.
// Exporting the dynamic component directly forwards `snapshots`/`pointsMax`.
const FactionHealthChart = dynamic(() => import('./FactionHealthChart'), {
    ssr: false,
});

export default FactionHealthChart;
