//db
import { getApiKeysByUserId } from '@/db/queries/api';
//forms
import { GenerateApiKeyForm, DeleteApiKeyForm } from '@/features/account/ApiForm';
//utils
import { timeSince } from '@/shared/utils/time';

export default async function ApiDashboard({ user }) {
    if (!user) {
        return <div>ApiDashboard - No user found</div>;
    }

    return (
        <div className="flex flex-col gap-3">
            <h2>API Keys</h2>
            <GenerateApiKeyForm userId={user.id} />
            <ApiKeysList userId={user.id} />
        </div>
    );
}

async function ApiKeysList({ userId }) {
    const result = await getApiKeysByUserId(userId);
    const apiKeys = result.query;

    if (!apiKeys || apiKeys.length === 0) {
        return <p className="text-sm text-text-muted">No API keys yet.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-xs font-mono text-text-muted uppercase">
                        <th scope="col" className="pb-2">Name</th>
                        <th scope="col" className="pb-2">Key</th>
                        <th scope="col" className="pb-2">Created</th>
                        <th scope="col" className="pb-2">Enabled</th>
                        <th scope="col" className="pb-2">
                            <span className="sr-only">Actions</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {apiKeys
                        .sort((a, b) => b.createdAt - a.createdAt)
                        .map((apikey) => (
                            <tr key={apikey.id} className="border-t border-ghost">
                                <td className="py-2 text-text">
                                    {apikey.description}
                                </td>
                                <td className="py-2 font-mono text-text-muted">
                                    {'****' + apikey.visible}
                                </td>
                                <td className="py-2 text-text-muted">
                                    {timeSince(apikey.createdAt)}
                                </td>
                                <td className="py-2 text-text-muted">
                                    {apikey.enabled ? 'Yes' : 'No'}
                                </td>
                                <td className="py-2">
                                    <DeleteApiKeyForm
                                        userId={userId}
                                        apikeyId={apikey.id}
                                    />
                                </td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </div>
    );
}
