import PageSkeleton from '@/shared/components/PageSkeleton';

// Suspense fallback for /profile — auth session check + account DB queries.
export default function Loading() {
    return <PageSkeleton />;
}
