//auth
import { auth } from '@/auth';
//next
import Image from 'next/image';
import Link from 'next/link';
//components
import { SignIn, SignOut } from '@/components/layout/Auth';
import Navigation from '@/components/layout/Navigation';
//utils
import { getGravatarUrl } from '@/utils/gravatar';

export default async function Header() {
    return (
        <header className="sticky top-0 z-50 flex h-[80px] w-full bg-red-500 xl:relative">
            <div className="mx-24 flex w-full items-center justify-between">
                <Logo />
                <div className="flex gap-4">
                    <Navigation />
                    <User />
                </div>
            </div>
        </header>
    );
}

async function User() {
    const session = await auth();
    // console.log(session);

    if (!session || !session.user) {
        return (
            <>
                <SignIn />
            </>
        );
    }

    let avatarUrl = '';
    if (session.user.image === null) {
        avatarUrl = getGravatarUrl(session.user.email);
    } else {
        avatarUrl = session.user.image;
    }
    //only do this in settings, in header fallback to no image

    return (
        <div className="flex items-center gap-4">
            <Image
                src={avatarUrl}
                className="rounded-full"
                alt="Logo of Helldivers Bot, which is a cartoon depiction of a spy sattelite"
                width={40}
                height={40}
                priority
            />
            <SignOut />
        </div>
    );
}

function Logo() {
    return (
        <Link
            href="/"
            className="flex flex-row items-center justify-center gap-2 text-2xl font-bold"
            aria-label="Go to homepage"
        >
            <Image
                src="/logo.png"
                alt="Logo of Helldivers Bot, which is a cartoon depiction of a spy sattelite"
                width={60}
                height={60}
                priority
            />
            <h1 className="whitespace-nowrap">Helldivers Bot</h1>
        </Link>
    );
}
