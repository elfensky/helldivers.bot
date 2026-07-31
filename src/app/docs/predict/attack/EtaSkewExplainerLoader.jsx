'use client';

import dynamic from 'next/dynamic';

// Lazy-loads the recharts-backed EtaSkewExplainer so recharts stays out of
// the /docs/predict/attack initial bundle. Mirrors GammaExplorerLoader.
const EtaSkewExplainer = dynamic(() => import('./EtaSkewExplainer'), {
    ssr: false,
});

export default EtaSkewExplainer;
