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
            <h2 className="text-4xl">API Keys</h2>
            <GenerateApiKeyForm userId={user.id} />
            <ApiKeysList userId={user.id} />
        </div>
    );
}

async function ApiKeysList({ userId }) {
    const query = await getApiKeysByUserId(userId);

    // console.log(typeof query.data);
    // if (typeof query.data !== 'array' && query.data.length < 1) {
    //     return <div>No API keys found</div>;
    // }

    const apiKeys = query.data;
    // console.log('ApiKeysList | apiKeys', apiKeys);

    return (
        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Last 4 characters</th>
                    <th>Created At</th>
                    <th>Enabled</th>
                    <th></th>
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
