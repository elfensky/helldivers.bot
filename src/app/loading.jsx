import PageSkeleton from '@/shared/components/PageSkeleton';

// Suspense fallback for the homepage (campaign data + 24h stat aggregations);
// also the default fallback inherited by any route segment without its own
// loading.jsx.
export default function Loading() {
    return <PageSkeleton />;
}
