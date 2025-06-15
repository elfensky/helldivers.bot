//auth
import './Header.css';
import { auth } from '@/auth';
//next
import Image from 'next/image';
import Link from 'next/link';
//components
import { SignIn, SignOut } from '@/components/layout/Auth';
import Navigation from '@/components/layout/Navigation';
//utils
import { getGravatarUrl } from '@/utils/gravatar';
import Script from 'next/script';
//rename component to UpperCase

export default async function Header() {
    return (
        <header
            id="header"
            className="fixed top-0 z-50 flex h-[80px] w-full text-white"
            style={{ top: '0px', backgroundColor: 'rgba(0, 0, 0, 0)' }} //will be adjusted on scroll by header.js
        >
            {/* sticky xl:relative */}
            <div className="mx-2 flex w-full items-center justify-between sm:mx-24">
                <Logo />
                <div className="hidden gap-4 sm:flex">
                    <Navigation />
                    <User />
                </div>
            </div>
            <Script src="/scripts/header.js" strategy="afterInteractive" />
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
                priority={true}
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
                    src="/images/logo.webp"
                    alt="Logo of Helldivers Bot, which is a cartoon depiction of a spy satellite"
                    className="max-w-[2rem]"
                    width={315}
                    height={403}
                    priority={true}
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
