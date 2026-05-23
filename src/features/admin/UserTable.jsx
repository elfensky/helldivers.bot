import { getAllUsers } from '@/features/admin/actions.mjs';
import UserTableClient from '@/features/admin/UserTableClient';

export default async function UserTable({ currentUserId }) {
    const result = await getAllUsers();

    if (result.errors) {
        return <div className="text-body text-danger">Failed to load users.</div>;
    }

    const users = (result.data ?? []).map((u) => ({
        ...u,
        createdAt: u.createdAt?.toISOString?.() ?? u.createdAt,
    }));
    const adminCount = users.filter((u) => u.role === 'admin').length;

    return (
        <UserTableClient
            users={users}
            adminCount={adminCount}
            currentUserId={currentUserId}
        />
    );
}
