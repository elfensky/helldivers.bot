'use client';

import dynamic from 'next/dynamic';

const ProgressExplainer = dynamic(
    () => import('./ProgressExplainer'),
    { ssr: false },
);

export default function ProgressExplainerLoader() {
    return <ProgressExplainer />;
}
