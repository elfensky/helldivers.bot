//auth
import { auth } from '@/auth';
//next
import Link from 'next/link';
import Image from 'next/image';

export default async function Navigation() {
    // const router = useRouter();
    const session = await auth();

    const links = [
        { href: '/front/bot', label: 'Discord' },
        { href: '/front/reviews', label: 'Reviews' },
        { href: '/stats', label: 'Stats' },
        { href: '/docs', label: 'Docs' },
        // { href: '/swagger', label: 'API' },
        // { href: '/dashboard', label: 'Dashboard' },
    ];

    if (session && session.user) {
        links.push({ href: '/dashboard', label: 'Dashboard' });
    }

    return (
        <nav className="flex w-fit items-center gap-4 bg-red-400">
            <ul className="flex items-center gap-4">
                {links.map((link) => (
                    <li key={link.href}>
                        <Link href={link.href} className="">
                            {link.label}
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
