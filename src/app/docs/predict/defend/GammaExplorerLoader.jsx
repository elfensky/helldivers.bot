'use client';

import dynamic from 'next/dynamic';

// Lazy-loads the recharts-backed GammaExplorer so recharts stays out of the
// /docs/predict initial bundle. Mirrors DefendRegularityChartLoader.
const GammaExplorer = dynamic(() => import('./GammaExplorer'), {
    ssr: false,
});

export default GammaExplorer;
