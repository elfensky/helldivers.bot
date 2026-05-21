import PageSkeleton from '@/shared/components/PageSkeleton';

// Suspense fallback for /archives — heavy data fetch (campaign + on-demand
// season backfill from the official HD1 API on first request).
export default function Loading() {
    return <PageSkeleton />;
}
