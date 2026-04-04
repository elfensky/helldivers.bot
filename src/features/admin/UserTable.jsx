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

export default function UserTable({ users, adminCount, currentUserId }) {
    const [selectedUser, setSelectedUser] = useState(null);
    const [keys, setKeys] = useState(null);

    const handleShowKeys = async (user) => {
        if (selectedUser?.id === user.id) {
            setSelectedUser(null);
            setKeys(null);
            return;
        }
        const fd = new FormData();
        fd.append('userId', user.id);
        const result = await adminGetUserApiKeys(null, fd);
        if (result.data) setKeys(result.data);
        setSelectedUser(user);
    };

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
                                <UserRow
                                    key={u.id}
                                    user={u}
                                    isSelected={selectedUser?.id === u.id}
                                    onShowKeys={() => handleShowKeys(u)}
                                    adminCount={adminCount}
                                    currentUserId={currentUserId}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="bg-primary" />
            </div>

            {selectedUser && keys && (
                <div className="flex flex-col gap-2">
                    <h3 className="text-sm text-text-muted">
                        API Keys for {selectedUser.name ?? 'Anonymous'}
                    </h3>
                    <KeysList keys={keys} />
                </div>
            )}
        </div>
    );
}

function UserRow({ user, isSelected, onShowKeys, adminCount, currentUserId }) {
    const [roleState, roleAction, rolePending] = useActionState(updateUserRole, null);
    const [banState, banAction, banPending] = useActionState(toggleUserBan, null);

    const isBanned = user.banned;
    const isSelf = user.id === currentUserId;
    const isLastAdmin = user.role === 'admin' && adminCount === 1;
    const roleDisabled = rolePending || isSelf || isLastAdmin;
    const banDisabled = banPending || isLastAdmin;

    return (
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
                        disabled={roleDisabled}
                        title={
                            isSelf
                                ? 'Cannot change your own role'
                                : isLastAdmin
                                  ? 'Cannot demote the last admin'
                                  : undefined
                        }
                        className={`bg-surface-2 px-2 py-0.5 text-xs ${roleDisabled ? 'text-text-muted cursor-not-allowed' : 'text-text'}`}
                    >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                    </select>
                </form>
            </td>
            <td className="py-2">
                <button
                    type="button"
                    onClick={onShowKeys}
                    className={`cursor-pointer border px-2 py-0.5 text-xs ${
                        isSelected
                            ? 'border-primary text-primary'
                            : 'border-ghost text-text-muted hover:text-text'
                    }`}
                >
                    {isSelected ? 'Hide' : `Keys (${user._count.apiKeys})`}
                </button>
            </td>
            <td className="py-2">
                {isSelf ? null : (
                    <form action={banAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input
                            type="hidden"
                            name="banned"
                            value={isBanned ? 'false' : 'true'}
                        />
                        <button
                            type="submit"
                            disabled={banDisabled}
                            title={isLastAdmin ? 'Cannot ban the last admin' : undefined}
                            className={`cursor-pointer border px-2 py-0.5 text-xs disabled:cursor-not-allowed disabled:opacity-50 ${
                                isBanned
                                    ? 'border-green-400 text-green-400'
                                    : 'border-danger text-danger'
                            }`}
                        >
                            {isBanned ? 'Unban' : 'Ban'}
                        </button>
                    </form>
                )}
            </td>
        </tr>
    );
}

function KeysList({ keys }) {
    const [revokeState, revokeAction, revokePending] = useActionState(
        adminRevokeApiKey,
        null,
    );

    if (keys.length === 0) {
        return <p className="text-xs text-text-muted">No API keys</p>;
    }

    return (
        <div className="grid grid-cols-[minmax(0,1fr)_4px] border border-ghost bg-surface-1">
            <div className="flex flex-col gap-1 p-3">
                {keys.map((key) => (
                    <div
                        key={key.id}
                        className="flex items-center justify-between text-xs"
                    >
                        <span className="text-text-muted">
                            {key.description} · <span className="font-mono">****{key.visible}</span> ·{' '}
                            {timeSince(key.createdAt)} ·{' '}
                            {key.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <form action={revokeAction}>
                            <input type="hidden" name="apikeyId" value={key.id} />
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
            <div className="bg-danger" />
        </div>
    );
}
