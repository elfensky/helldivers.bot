import './Navigation.css';
//auth
import { auth } from '@/auth';
//next
import Link from 'next/link';
import Image from 'next/image';
//
import { SignIn, SignOut } from '@/components/layout/Auth/Auth';
import { MdMenu } from 'react-icons/md';

export default async function Navigation() {
    // const router = useRouter();
    const session = await auth();

    const links = [
        // { href: '/discord', label: 'Discord' },
        // { href: '/reviews', label: 'Reviews' },
        // { href: '/history', label: 'History' },
        // { href: '/stats', label: 'Stats' },
        { href: '/war', label: 'War' },
        { href: '/docs', label: 'Docs' },
        { href: '/api', label: 'API' },
    ];

    if (session && session.user) {
        //only show if user is logged in
        links.push({ href: '/dashboard', label: 'Dashboard' });
    }

    return (
        <nav className="z-50">
            <ul
                id="navigation"
                // opacity-0
                // top-full
                // -top-full
                className="pointer-events-none absolute -top-[400%] right-0 z-0 flex w-full flex-col items-end justify-end gap-1 py-4 pr-4 text-right sm:right-12 md:pointer-events-auto md:relative md:right-0 md:w-fit md:flex-row md:items-center md:gap-4 md:p-0"
            >
                <li>
                    <Link
                        href="https://github.com/elfensky/helldivers1api"
                        data-umami-event="header-github"
                    >
                        <figure className="m-0 flex flex-row items-center gap-2">
                            <svg
                                className="w-8"
                                width="98"
                                height="96"
                                viewBox="0 0 98 96"
                                xmlns="http://www.w3.org/2000/svg"
                                style={{ maxHeight: '32px', maxWidth: '32px' }}
                            >
                                <path
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                    d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
                                    fill="#fff"
                                />
                            </svg>
                            <figcaption className="whitespace-nowrap md:hidden">
                                GitHub
                            </figcaption>
                        </figure>
                    </Link>
                </li>

                {links.map((link) => (
                    <li key={link.href}>
                        <Link
                            href={link.href}
                            data-umami-event={'header-' + link.label.toLowerCase()}
                        >
                            {link.label}
                        </Link>
                    </li>
                ))}

                <li>
                    <User />
                </li>
            </ul>

            <button className="z-50 flex h-12 w-12 cursor-pointer items-center justify-end md:hidden">
                <MdMenu id="menu" className="text-2xl" />
            </button>
        </nav>
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
