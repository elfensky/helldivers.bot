//auth
import './Header.css';
import { auth } from '@/auth';
//next
import Image from 'next/image';
import Link from 'next/link';
//components
import Navigation from '@/components/layout/Navigation/Navigation';
//utils
import { getGravatarUrl } from '@/utils/gravatar';
import Script from 'next/script';
//rename component to UpperCase
//icons

export default async function Header() {
    return (
        <header
            id="header"
            className="fixed top-0 z-50 flex h-[50px] w-full text-white sm:h-[80px]"
        >
            <div className="gutters flex w-full items-center justify-between">
                <Logo />
                <Navigation />
            </div>

            <Script src="/scripts/headerCPU.js?111a" strategy="afterInteractive" />
            <Script src="/scripts/navigation.js" strategy="afterInteractive" />
        </header>
    );
}

function Logo() {
    return (
        <Link
            href="/"
            data-umami-event={'header-home'}
            aria-label="Go to homepage"
            className="z-50 flex flex-row items-center justify-center gap-2 text-[1.1rem] font-bold sm:text-2xl"
        >
            <figure className="relative m-0 flex flex-row items-center gap-2">
                <Image
                    src="/images/logo.webp"
                    alt="Logo of Helldivers Bot, which is a cartoon depiction of a spy satellite"
                    className="max-w-[1.5rem] sm:max-w-[2rem]"
                    width={315}
                    height={403}
                    priority={true}
                />
                <figcaption className="whitespace-nowrap">Helldivers Bot</figcaption>
            </figure>
        </Link>
    );
}
