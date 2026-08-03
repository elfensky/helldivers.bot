'use client';

import dynamic from 'next/dynamic';

// Lazy-loads the recharts-backed VerdictAccuracyChart so recharts stays out
// of the /docs/predict initial bundle. Mirrors EtaSkewExplainerLoader.
const VerdictAccuracyChart = dynamic(() => import('./VerdictAccuracyChart'), {
    ssr: false,
});

export default VerdictAccuracyChart;
