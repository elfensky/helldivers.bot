'use client';

import dynamic from 'next/dynamic';

// Lazy-loads the recharts-backed RatioTrendChart so its chart code stays out of
// the /stats initial bundle — the Combat Telemetry section only renders once a
// season carries live telemetry. Mirrors FactionHealthChartLoader. Exporting
// the dynamic component directly forwards `data`/`label`/`color`/`decimals`.
const RatioTrendChart = dynamic(() => import('./RatioTrendChart'), {
    ssr: false,
});

export default RatioTrendChart;
