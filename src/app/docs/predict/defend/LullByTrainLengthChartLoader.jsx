'use client';

import dynamic from 'next/dynamic';

// Lazy-loads the recharts-backed LullByTrainLengthChart so recharts stays
// out of the /docs/predict initial bundle. Mirrors PlayersOverTimeChartLoader.
const LullByTrainLengthChart = dynamic(() => import('./LullByTrainLengthChart'), {
    ssr: false,
});

export default LullByTrainLengthChart;
