'use client';
import { useActionState, useCallback } from 'react';
import Form from 'next/form';
import { exportUserData, deleteUserAccount } from '@/db/queries/account';

export default function AccountActions({ user }) {
    const handleExport = useCallback(async () => {
        const result = await exportUserData(user.id);
        if (result.data) {
            const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `helldivers-bot-data-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }, [user.id]);

    const [deleteState, deleteAction, deletePending] = useActionState(deleteUserAccount, null);

    return (
        <div className="grid grid-cols-[1fr_4px]">
            <div className="flex flex-col gap-4 bg-surface-1 p-4">
                <h2 className="font-semibold text-text">Your Data</h2>

                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={handleExport}
                        className="w-fit cursor-pointer border border-ghost px-3 py-1.5 text-sm text-text-muted hover:text-text"
                    >
                        Download My Data
                    </button>
                </div>

                <div className="flex flex-col gap-2">
                    <p className="text-sm text-text-muted">
                        Permanently delete your account and all associated data. This cannot be undone.
                    </p>
                    {deleteState?.errors?.confirmEmail && (
                        <span role="alert" className="text-sm text-danger">
                            {deleteState.errors.confirmEmail}
                        </span>
                    )}
                    {deleteState?.errors?.auth && (
                        <span role="alert" className="text-sm text-danger">
                            {deleteState.errors.auth}
                        </span>
                    )}
                    <Form action={deleteAction} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <input
                            type="email"
                            name="confirmEmail"
                            placeholder="Type your email to confirm"
                            className="bg-surface-2 px-3 py-1.5 text-sm text-text placeholder:text-text-muted"
                            required
                        />
                        <button
                            type="submit"
                            disabled={deletePending}
                            className="cursor-pointer border border-danger px-3 py-1.5 text-sm text-danger hover:bg-danger hover:text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Delete Account
                        </button>
                    </Form>
                </div>
            </div>
            <div className="bg-danger" />
        </div>
    );
}
