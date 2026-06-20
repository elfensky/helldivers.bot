'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import { exportUserData, deleteUserAccount } from '@/features/account/actions.mjs';
import { linkSocial, unlinkAccount } from '@/auth-client';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import Button from '@/shared/components/Button/Button';

const SOCIAL_PROVIDERS = ['discord', 'github', 'google'];

export default function AccountActions({ user, avatarUrl, providers, canUnlink }) {
    const router = useRouter();
    const [loading, setLoading] = useState(/** @type {string | null} */ (null));
    const [linkError, setLinkError] = useState(/** @type {string | null} */ (null));

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
        if (result.errors) {
            toast.error('Could not export account data. Please refresh and try again.');
            return;
        }
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
    const [deleteError, setDeleteError] = useState(/** @type {string | null} */ (null));

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
        if (result?.data?.deleted) {
            window.location.href = '/';
            return;
        }
        if (result?.errors) {
            setDeleteError(Object.values(result.errors).flat().join(', '));
        } else {
            toast.error('Could not delete account. Please refresh and try again.');
        }
        setDeleting(false);
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
                                                <Button
                                                    variant="danger"
                                                    onClick={() =>
                                                        handleUnlink(
                                                            provider,
                                                            linked.accountId,
                                                        )
                                                    }
                                                    disabled={isLoading}
                                                >
                                                    {isLoading ? 'Unlinking…' : 'Unlink'}
                                                </Button>
                                            )
                                        :   <Button
                                                variant="primary"
                                                onClick={() => handleLink(provider)}
                                                disabled={isLoading}
                                            >
                                                {isLoading ? 'Linking…' : 'Link'}
                                            </Button>
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
                        <Button variant="primary" size="lg" onClick={handleExport}>
                            Download My Data
                        </Button>
                        <Button
                            variant="danger"
                            size="lg"
                            onClick={handleDelete}
                            disabled={deleting}
                        >
                            {deleting ? 'Deleting…' : 'Delete Account'}
                        </Button>
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
