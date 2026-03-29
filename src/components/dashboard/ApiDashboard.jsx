'use server';
//db
import { getApiKeysByUserId } from '@/db/queries/api';
//forms
import { GenerateApiKeyForm, DeleteApiKeyForm } from '@/components/dashboard/ApiForm';
//utils
import { timeSince } from '@/utils/time';

export default async function ApiDashboard({ user }) {
    if (!user) {
        return <div>ApiDashboard - No user found</div>;
    }

    return (
        <div className="flex flex-col gap-2">
            <h2>API Keys</h2>
            <GenerateApiKeyForm userId={user.id} />
            <ApiKeysList userId={user.id} />
        </div>
    );
}

async function ApiKeysList({ userId }) {
    const result = await getApiKeysByUserId(userId);
    const apiKeys = result.query;

    return (
        <table>
            <thead>
                <tr>
                    <th scope="col">Description</th>
                    <th scope="col">Last 4 characters</th>
                    <th scope="col">Created At</th>
                    <th scope="col">Enabled</th>
                    <th scope="col">
                        <span className="sr-only">Actions</span>
                    </th>
                </tr>
            </thead>
            <tbody>
                {apiKeys
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((apikey, index) => (
                        <tr key={apikey.id}>
                            <td>{apikey.description}</td>

                            <td>{'********-****-****-****-********' + apikey.visible}</td>
                            <td>{timeSince(apikey.createdAt)}</td>
                            <td>{apikey.enabled ? 'Yes' : 'No'}</td>
                            <td>
                                <DeleteApiKeyForm userId={userId} apikeyId={apikey.id} />
                            </td>
                        </tr>
                    ))}
            </tbody>
        </table>
    );
}
