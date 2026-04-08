import { Suspense } from 'react';
import SystemOverview from '@/features/admin/SystemOverview';
import DebugTools from '@/features/admin/DebugTools';
import UserTable from '@/features/admin/UserTable';
import AdminApiKeys from '@/features/admin/AdminApiKeys';

export default function AdminSection({ currentUserId }) {
    return (
        <div className="flex flex-col gap-4">
            <h2>Admin</h2>
            <Suspense fallback={<SectionSkeleton label="System Overview" />}>
                <SystemOverview />
            </Suspense>
            <DebugTools />
            <Suspense fallback={<SectionSkeleton label="User Management" />}>
                <UserTable currentUserId={currentUserId} />
            </Suspense>
            <Suspense fallback={<SectionSkeleton label="API Keys" />}>
                <AdminApiKeys />
            </Suspense>
        </div>
    );
}

function SectionSkeleton({ label }) {
    return (
        <section>
            <h3 className="mb-2 font-mono text-small text-text-muted uppercase">{label}</h3>
            <div className="h-20 animate-pulse border border-ghost bg-surface-1" />
        </section>
    );
}
