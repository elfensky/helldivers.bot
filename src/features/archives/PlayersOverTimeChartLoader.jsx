'use client';

import dynamic from 'next/dynamic';

// Lazy-loads the recharts-backed PlayersOverTimeChart so its chart code stays
// out of the /archives initial bundle — the chart only matters once a season
// has player telemetry. Mirrors FactionHealthChartLoader. Exporting the dynamic
// component directly forwards `playerTimeseries`/`events`/`faction`/`warStart`.
const PlayersOverTimeChart = dynamic(() => import('./PlayersOverTimeChart'), {
    ssr: false,
});

export default PlayersOverTimeChart;
