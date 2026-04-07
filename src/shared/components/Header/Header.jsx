//next
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import { headers } from 'next/headers';
//components
import Navigation from '@/shared/components/Navigation/Navigation';

export default async function Header() {
    const nonce = (await headers()).get('x-nonce') ?? undefined;

    return (
        <header
            id="header"
            className="fixed top-0 z-50 flex h-[50px] w-full text-white sm:h-[80px]"
        >
            <div className="p-gutters mx-auto flex w-full max-w-[1536px] items-center justify-between">
                <Logo />
                <Navigation />
            </div>
            <Script
                nonce={nonce}
                src="/scripts/headerGPU.js"
                strategy="afterInteractive"
            />
        </header>
    );
}

function Logo() {
    return (
        <Link
            href="/"
            prefetch={false}
            data-umami-event={'header-home'}
            aria-label="Go to homepage"
            className="z-50 flex flex-row items-center justify-center gap-2 text-h2 font-bold"
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
