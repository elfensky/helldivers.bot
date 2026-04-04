'use client';
import { useActionState, useState } from 'react';
import Image from 'next/image';
import {
    updateUserRole,
    toggleUserBan,
    adminGetUserApiKeys,
    adminRevokeApiKey,
} from '@/db/queries/admin';
import { timeSince } from '@/shared/utils/time';

export default function UserTable({ users }) {
    return (
        <div className="flex flex-col gap-3">
            <h2>User Management</h2>
            <div className="grid grid-cols-[minmax(0,1fr)_4px] border border-ghost bg-surface-1">
                <div className="overflow-x-auto p-3">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs font-mono text-text-muted uppercase">
                                <th className="pb-2">User</th>
                                <th className="pb-2">Email</th>
                                <th className="pb-2">Role</th>
                                <th className="pb-2">Keys</th>
                                <th className="pb-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <UserRow key={u.id} user={u} />
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="bg-primary" />
            </div>
        </div>
    );
}

function UserRow({ user }) {
    const [showKeys, setShowKeys] = useState(false);
    const [keys, setKeys] = useState(null);

    const [roleState, roleAction, rolePending] = useActionState(updateUserRole, null);
    const [banState, banAction, banPending] = useActionState(toggleUserBan, null);
    const [revokeState, revokeAction, revokePending] = useActionState(
        adminRevokeApiKey,
        null,
    );

    const handleShowKeys = async () => {
        if (showKeys) {
            setShowKeys(false);
            return;
        }
        const fd = new FormData();
        fd.append('userId', user.id);
        const result = await adminGetUserApiKeys(null, fd);
        if (result.data) setKeys(result.data);
        setShowKeys(true);
    };

    const isBanned = user.banned;

    return (
        <>
            <tr className={isBanned ? 'opacity-50' : ''}>
                <td className="py-2">
                    <div className="flex items-center gap-2">
                        {user.image && (
                            <Image
                                src={user.image}
                                alt=""
                                width={20}
                                height={20}
                                className="rounded-full"
                            />
                        )}
                        <span className={`text-text ${isBanned ? 'line-through' : ''}`}>
                            {user.name ?? 'Anonymous'}
                        </span>
                    </div>
                </td>
                <td className="py-2 text-text-muted">{user.email}</td>
                <td className="py-2">
                    <form action={roleAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <select
                            name="newRole"
                            defaultValue={user.role}
                            onChange={(e) => e.target.form.requestSubmit()}
                            disabled={rolePending}
                            className="bg-surface-2 px-2 py-0.5 text-xs text-text"
                        >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                        </select>
                    </form>
                </td>
                <td className="py-2">
                    <button
                        type="button"
                        onClick={handleShowKeys}
                        className="cursor-pointer border border-ghost px-2 py-0.5 text-xs text-text-muted hover:text-text"
                    >
                        {showKeys ? 'Hide' : `Keys (${user._count.apiKeys})`}
                    </button>
                </td>
                <td className="py-2">
                    <form action={banAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input
                            type="hidden"
                            name="banned"
                            value={isBanned ? 'false' : 'true'}
                        />
                        <button
                            type="submit"
                            disabled={banPending}
                            className={`cursor-pointer border px-2 py-0.5 text-xs disabled:cursor-not-allowed disabled:opacity-50 ${
                                isBanned
                                    ? 'border-green-400 text-green-400'
                                    : 'border-danger text-danger'
                            }`}
                        >
                            {isBanned ? 'Unban' : 'Ban'}
                        </button>
                    </form>
                </td>
            </tr>
            {showKeys && keys && (
                <tr>
                    <td colSpan={5} className="pb-2">
                        <div className="ml-6 flex flex-col gap-1 border-l-2 border-ghost pl-3">
                            {keys.length === 0 && (
                                <p className="text-xs text-text-muted">No API keys</p>
                            )}
                            {keys.map((key) => (
                                <div
                                    key={key.id}
                                    className="flex items-center justify-between text-xs"
                                >
                                    <span className="text-text-muted">
                                        {key.description} · ****{key.visible} ·{' '}
                                        {timeSince(key.createdAt)}
                                    </span>
                                    <form action={revokeAction}>
                                        <input
                                            type="hidden"
                                            name="apikeyId"
                                            value={key.id}
                                        />
                                        <button
                                            type="submit"
                                            disabled={revokePending}
                                            className="cursor-pointer text-danger hover:underline disabled:cursor-not-allowed"
                                        >
                                            Revoke
                                        </button>
                                    </form>
                                </div>
                            ))}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
