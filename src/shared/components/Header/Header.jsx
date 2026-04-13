//next
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import { headers } from 'next/headers';
//components
import Navigation from '@/shared/components/Navigation/Navigation';

/**
 * Fixed top header. Two breakpoint personalities:
 *
 *   - Mobile (<md / <768px): `background: var(--color-surface-1)` +
 *     `border-bottom: 1px solid var(--color-ghost)` (set in
 *     `src/app/layout.css`). Gives the header a solid panel look.
 *
 *   - Tablet+ (md+): transparent by default and gains a glass effect
 *     (`rgba(19,19,19,0.85)` + `backdrop-filter: blur(8.8px)`) when
 *     scroll-revealed mid-page. Scroll-hides itself by translating
 *     `style.top` between `0` and `-80px`. All of this is driven by
 *     `public/scripts/headerGPU.js`, loaded below as a nonce-gated
 *     `<Script>`.
 *
 * The `z-40` utility is deliberate: the pinned galaxy map on
 * `/` and `/archives` uses `z-50` with a `top: 49/79px` offset to
 * paint **above** the header's `z-40` at their 1px overlap row,
 * which hides the header's ghost bottom border and makes the two
 * dark panels read as one continuous plane. See
 * `/docs/frontend-layout` for the full story.
 */
export default async function Header() {
    const nonce = (await headers()).get('x-nonce') ?? undefined;

    return (
        <header
            id="header"
            className="fixed top-0 z-40 flex h-[50px] w-full text-white sm:h-[80px]"
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
            data-umami-event="nav-home"
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
