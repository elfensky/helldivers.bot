import ApiDashboard from '@/features/account/ApiDashboard';
import AccountActions from '@/features/account/AccountActions';

export default function AccountSection({ user, avatarUrl, providers, canUnlink }) {
    return (
        <div className="flex flex-col gap-4">
            <h2>Your Account</h2>
            <AccountActions
                user={user}
                avatarUrl={avatarUrl}
                providers={providers}
                canUnlink={canUnlink}
            />
            <ApiDashboard user={user} />
        </div>
    );
}
