import ApiDashboard from '@/features/account/ApiDashboard';
import AccountActions from '@/features/account/AccountActions';
import IdentifySwitch from '@/features/account/IdentifySwitch';

export default function AccountSection({ user, avatarUrl, providers, canUnlink }) {
    return (
        <div className="flex flex-col gap-4">
            <h2>Profile</h2>
            <AccountActions
                user={user}
                avatarUrl={avatarUrl}
                providers={providers}
                canUnlink={canUnlink}
            />
            <IdentifySwitch initial={user.identifyConsent === true} />
            <ApiDashboard user={user} />
        </div>
    );
}
