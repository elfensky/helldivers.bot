//auth
import { auth } from '@/auth';
//next
import Image from 'next/image';
import Link from 'next/link';
//components
import { SignIn, SignOut } from '@/components/layout2/Auth';
import Navigation from '@/components/layout2/Navigation';
//utils
import { getGravatarUrl } from '@/utils/gravatar';
//rename component to UpperCAse

export default async function Header() {
    return (
        <header className="fixed top-0 z-20 flex h-[80px] w-full bg-transparent">
            {/* sticky xl:relative */}
            <div className="mx-2 flex w-full items-center justify-between sm:mx-24">
                <Logo />
                <div className="hidden gap-4 sm:flex">
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
            aria-label="Go to homepage"
            className="flex flex-row items-center justify-center gap-2 text-2xl font-bold"
        >
            <figure className="m-0 flex flex-row items-center gap-2">
                <Image
                    src="/images/logo.png"
                    alt="Logo of Helldivers Bot, which is a cartoon depiction of a spy satellite"
                    width={60}
                    height={60}
                    priority
                />
                <figcaption
                    className="whitespace-nowrap"
                    style={{ fontFamily: 'Insignia, sans-serif' }}
                >
                    Helldivers Bot
                </figcaption>
            </figure>
        </Link>
    );
}
