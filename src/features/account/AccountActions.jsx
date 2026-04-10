'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { exportUserData, deleteUserAccount } from '@/db/queries/account';
import { linkSocial, unlinkAccount } from '@/auth-client';
import { tryCatch } from '@/shared/utils/tryCatch';

const SOCIAL_PROVIDERS = ['discord', 'github'];

export default function AccountActions({ user, avatarUrl, providers, canUnlink }) {
    const router = useRouter();
    const [loading, setLoading] = useState(null);
    const [linkError, setLinkError] = useState(null);

    const handleLink = async (provider) => {
        setLoading(provider);
        setLinkError(null);
        const { error } = await tryCatch(linkSocial(provider));
        if (error) {
            setLinkError(`Failed to link ${provider}`);
            setLoading(null);
        }
    };

    const handleUnlink = async (providerId, accountId) => {
        setLoading(providerId);
        setLinkError(null);
        const { error } = await tryCatch(unlinkAccount(providerId, accountId));
        if (error) {
            setLinkError(`Failed to unlink ${providerId}`);
        }
        setLoading(null);
        router.refresh();
    };

    const handleExport = useCallback(async () => {
        const result = await exportUserData(user.id);
        if (result.data) {
            const blob = new Blob([JSON.stringify(result.data, null, 2)], {
                type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `helldivers-bot-data-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }, [user.id]);

    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState(null);

    const handleDelete = useCallback(async () => {
        if (
            !window.confirm(
                'Permanently delete your account and all data? This cannot be undone.',
            )
        )
            return;
        setDeleting(true);
        setDeleteError(null);
        const fd = new FormData();
        fd.append('userId', user.id);
        const result = await deleteUserAccount(null, fd);
        if (result?.errors) {
            setDeleteError(Object.values(result.errors).flat().join(', '));
            setDeleting(false);
        } else {
            window.location.href = '/';
        }
    }, [user.id]);

    return (
        <div className="flex flex-col gap-3">
            <h3>Your Data</h3>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Left: account info */}
                <div className="flex items-start gap-4">
                    <Image
                        src={avatarUrl}
                        alt={`${user.name ?? 'User'} avatar`}
                        width={48}
                        height={48}
                        className="rounded-full"
                    />
                    <div>
                        <p className="font-semibold text-text">
                            {user.name ?? 'Anonymous'}
                        </p>
                        <p className="text-body text-text-muted">{user.email}</p>
                        <div className="mt-1 flex flex-col gap-1">
                            {SOCIAL_PROVIDERS.map((provider) => {
                                const linked = providers.find(
                                    (p) => p.providerId === provider,
                                );
                                const isOnlyAccount = !canUnlink;
                                const isLoading = loading === provider;
                                return (
                                    <div
                                        key={provider}
                                        className="flex items-center gap-2"
                                    >
                                        <span className="text-body text-text capitalize">
                                            {provider}
                                        </span>
                                        {linked ?
                                            !isOnlyAccount && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleUnlink(
                                                            provider,
                                                            linked.accountId,
                                                        )
                                                    }
                                                    disabled={isLoading}
                                                    className="cursor-pointer border border-danger px-2 py-0.5 text-small font-semibold text-danger hover:bg-danger hover:text-surface-0 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {isLoading ? 'Unlinking…' : 'Unlink'}
                                                </button>
                                            )
                                        :   <button
                                                type="button"
                                                onClick={() => handleLink(provider)}
                                                disabled={isLoading}
                                                className="cursor-pointer border border-primary px-2 py-0.5 text-small font-semibold text-primary hover:bg-primary hover:text-surface-0 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isLoading ? 'Linking…' : 'Link'}
                                            </button>
                                        }
                                    </div>
                                );
                            })}
                            {linkError && (
                                <p className="text-small text-danger">{linkError}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: actions */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleExport}
                            className="cursor-pointer border border-primary px-4 py-2 text-body font-semibold text-primary hover:bg-primary hover:text-surface-0"
                        >
                            Download My Data
                        </button>
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={deleting}
                            className="cursor-pointer border border-danger px-4 py-2 text-body font-semibold text-danger hover:bg-danger hover:text-surface-0 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {deleting ? 'Deleting…' : 'Delete Account'}
                        </button>
                    </div>
                    {deleteError && (
                        <span role="alert" className="text-small text-danger">
                            {deleteError}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
