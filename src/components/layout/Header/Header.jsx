import './Header.css';
//next
import Image from 'next/image';
import Link from 'next/link';
//components
import Navigation from '@/components/layout/Navigation/Navigation';

export default async function Header() {
    return (
        <header
            id="header"
            className="z-50 flex h-[50px] w-full overflow-hidden text-white sm:h-[80px]"
        >
            <div className="gutters flex w-full items-center justify-between">
                <Logo />
                <Navigation />
            </div>
        </header>
    );
}

function Logo() {
    return (
        <Link
            href="/"
            data-umami-event={'header-home'}
            aria-label="Go to homepage"
            className="z-50 flex flex-row items-center justify-center gap-2 text-[clamp(1.1rem,0.9rem+1vw,1.5rem)] font-bold"
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
