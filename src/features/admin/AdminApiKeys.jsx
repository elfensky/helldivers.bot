import { getAllApiKeys, adminRevokeApiKey } from '@/features/admin/actions.mjs';
import { timeSince } from '@/shared/utils/time.mjs';
import Button from '@/shared/components/Button/Button';

export default async function AdminApiKeys() {
    const result = await getAllApiKeys();

    if (result.errors) {
        return <div className="text-body text-danger">Failed to load API keys.</div>;
    }

    const keys = result.data ?? [];

    return (
        <section>
            <h3 className="mb-2 font-mono text-small text-text-muted uppercase">
                API Keys
            </h3>
            {keys.length === 0 ?
                <p className="text-small text-text-muted">No API keys.</p>
            :   <div className="overflow-x-auto border border-ghost bg-surface-1">
                    <table className="w-full text-body">
                        <thead>
                            <tr className="text-left font-mono text-small text-text-muted uppercase">
                                <th className="p-3 pb-2">Key</th>
                                <th className="p-3 pb-2">User</th>
                                <th className="p-3 pb-2">Created</th>
                                <th className="p-3 pb-2">Status</th>
                                <th className="p-3 pb-2">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {keys.map((key) => (
                                <tr
                                    key={key.id}
                                    className="border-t border-ghost/30 hover:bg-surface-2"
                                >
                                    <td className="p-3 font-mono text-small text-text">
                                        ****{key.visible}
                                    </td>
                                    <td className="p-3 text-small text-text-muted">
                                        {key.user.email}
                                    </td>
                                    <td className="p-3 text-small text-text-muted">
                                        {timeSince(key.createdAt)}
                                    </td>
                                    <td className="p-3 text-small">
                                        <span
                                            className={`inline-block h-1.5 w-1.5 rounded-full ${
                                                key.enabled ? 'bg-success' : 'bg-danger'
                                            }`}
                                        />{' '}
                                        {key.enabled ? 'Active' : 'Disabled'}
                                    </td>
                                    <td className="p-3">
                                        <form
                                            action={
                                                /** @type {(formData: FormData) => void} */ (
                                                    adminRevokeApiKey
                                                )
                                            }
                                        >
                                            <input
                                                type="hidden"
                                                name="apikeyId"
                                                value={key.id}
                                            />
                                            <Button type="submit" variant="danger">
                                                Revoke
                                            </Button>
                                        </form>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            }
        </section>
    );
}
