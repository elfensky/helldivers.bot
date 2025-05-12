import Link from 'next/link';
import Image from 'next/image';
import { SignIn, SignOut } from '@/components/layout/auth';
import { auth } from '@/auth';

export default function Header() {
    return (
        <header className="sticky flex justify-center border-b">
            <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
                <Navigation />
                <User />
            </div>
        </header>
    );
}

async function User() {
    const session = await auth();
    console.log(session);
    if (!session?.user) return <SignIn />;
    return <SignOut />;
}

function Navigation() {
    return (
        <nav className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <Link href="/" className="text-2xl font-bold">
                    <Image src="/logo.png" alt="Logo" width={40} height={40} priority />
                </Link>
                <Link href="/dashboard" className="text-2xl font-bold">
                    Helldivers Bot
                </Link>
            </div>
            {/* <div className="flex items-center gap-4">
                <Link href="/api" className="text-2xl font-bold">
                    API
                </Link>
                <Link href="/docs" className="text-2xl font-bold">
                    Docs
                </Link>
                <Link href="/dashboard" className="text-2xl font-bold">
                    Dashboard
                </Link>
            </div> */}
        </nav>
    );
}
