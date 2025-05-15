export default function Loading() {
    // You can add any UI inside Loading, including a Skeleton.
    return <LoadingSkeleton />;
}

function LoadingSkeleton() {
    return (
        <div className="flex h-full items-center justify-center">
            <div className="h-24 w-24 animate-pulse rounded-full bg-gray-200" />
        </div>
    );
}

// read more
// https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming
// https://react.dev/reference/react/Suspense
