'use client';

import { usePathname } from 'next/navigation';

import TermsPrompt from '@/features/consent/TermsPrompt';

// The terms and the notice stay readable before the terms are accepted.
const OPEN_PATHS = ['/legal', '/privacy'];

/**
 * Shows the terms page instead of the page content to a signed-in user who has
 * not accepted the terms (#617): a new account at signup, an existing one at
 * its next login. It stays until they accept.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.needsTerms - Signed in, terms not accepted yet.
 * @param {import('react').ReactNode} props.children - The page content.
 * @returns {import('react').ReactNode}
 */
export default function TermsGate({ needsTerms, children }) {
    const pathname = usePathname() ?? '/';
    const open = OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (!needsTerms || open) return children;
    return <TermsPrompt />;
}
