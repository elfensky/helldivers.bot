'use client';
import { useActionState } from 'react';
import Image from 'next/image';
import { updateUserRole, toggleUserBan } from '@/features/admin/actions.mjs';
import Button from '@/shared/components/Button/Button';

export default function UserTableClient({ users, adminCount, currentUserId }) {
    return (
        <section>
            <h3 className="mb-2 font-mono text-small text-text-muted uppercase">
                User Management
            </h3>
            <div className="overflow-x-auto border border-ghost bg-surface-1">
                <table className="w-full text-body">
                    <thead>
                        <tr className="text-left font-mono text-small text-text-muted uppercase">
                            <th className="p-3 pb-2">User</th>
                            <th className="p-3 pb-2">Providers</th>
                            <th className="p-3 pb-2">Keys</th>
                            <th className="p-3 pb-2">Role</th>
                            <th className="p-3 pb-2">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <UserRow
                                key={u.id}
                                user={u}
                                adminCount={adminCount}
                                currentUserId={currentUserId}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function UserRow({ user, adminCount, currentUserId }) {
    const [, roleAction, rolePending] = useActionState(updateUserRole, null);
    const [, banAction, banPending] = useActionState(toggleUserBan, null);

    const isBanned = user.banned;
    const isSelf = user.id === currentUserId;
    const isLastAdmin = user.role === 'admin' && adminCount === 1;
    const roleDisabled = rolePending || isSelf || isLastAdmin;
    const banDisabled = banPending || isLastAdmin;

    const providers = user.accounts?.map((a) => a.providerId) ?? [];

    // `title` is forwarded to the underlying <button> via Button's {...rest},
    // but Button's JSDoc doesn't declare it — cast so the prop is accepted.
    /** @type {{ title?: string }} */
    const banButtonProps = {
        title: isLastAdmin ? 'Cannot ban the last admin' : undefined,
    };

    return (
        <tr
            className={`border-t border-ghost/30 ${isBanned ? 'opacity-50' : ''} hover:bg-surface-2`}
        >
            <td className="p-3">
                <div className="flex items-center gap-2">
                    {user.image && (
                        <Image
                            src={user.image}
                            alt=""
                            width={24}
                            height={24}
                            className="rounded-full"
                        />
                    )}
                    <div>
                        <div
                            className={`text-small text-text ${isBanned ? 'line-through' : ''}`}
                        >
                            {user.name ?? 'Anonymous'}
                        </div>
                        <div className="text-small text-text-muted">{user.email}</div>
                    </div>
                </div>
            </td>
            <td className="p-3">
                <div className="flex gap-1">
                    {providers.map((p) => (
                        <span
                            key={p}
                            className="border border-ghost px-1.5 py-0.5 font-mono text-small text-text-muted capitalize"
                        >
                            {p}
                        </span>
                    ))}
                </div>
            </td>
            <td className="p-3 font-mono text-small text-text-muted">
                {user._count.apiKeys}
            </td>
            <td className="p-3">
                <form action={roleAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <select
                        name="newRole"
                        defaultValue={user.role}
                        onChange={(e) => e.target.form?.requestSubmit()}
                        disabled={roleDisabled}
                        title={
                            isSelf ? 'Cannot change your own role'
                            : isLastAdmin ?
                                'Cannot demote the last admin'
                            :   undefined
                        }
                        className={`bg-surface-2 px-2 py-0.5 font-mono text-small ${
                            roleDisabled ?
                                'cursor-not-allowed text-text-muted'
                            :   'text-text'
                        }`}
                    >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                    </select>
                </form>
            </td>
            <td className="p-3">
                {isSelf ? null : (
                    <form action={banAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input
                            type="hidden"
                            name="banned"
                            value={isBanned ? 'false' : 'true'}
                        />
                        <Button
                            type="submit"
                            variant={isBanned ? 'success' : 'danger'}
                            disabled={banDisabled}
                            {...banButtonProps}
                        >
                            {isBanned ? 'Unban' : 'Ban'}
                        </Button>
                    </form>
                )}
            </td>
        </tr>
    );
}
