'use client';

import dynamic from 'next/dynamic';

// Lazy-loads the recharts-backed PlayerEngagementChart so its chart code stays
// out of the /archives initial bundle — it only matters once a season has event
// player data. Mirrors FactionHealthChartLoader. Exporting the dynamic
// component directly forwards `events`/`warStart`.
const PlayerEngagementChart = dynamic(() => import('./PlayerEngagementChart'), {
    ssr: false,
});

export default PlayerEngagementChart;
