'use client';

import dynamic from 'next/dynamic';

// Lazy-loads the recharts-backed DefendRegularityChart so recharts stays out
// of the /docs/predict initial bundle. Mirrors PlayersOverTimeChartLoader.
const DefendRegularityChart = dynamic(() => import('./DefendRegularityChart'), {
    ssr: false,
});

export default DefendRegularityChart;
