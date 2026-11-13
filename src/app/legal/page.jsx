import Link from 'next/link';
import Hijackable from '@/features/ministry/Hijackable';

export const metadata = {
    title: 'Civic Compliance Protocols',
    description:
        'Terms of service, data protocols, and tracking rations — approved by Super Earth High Command.',
};

function SectionDivider() {
    return <hr className="my-8 border-ghost sm:my-12" />;
}

export default function LegalPage() {
    return (
        <div className="gutters mx-auto max-w-3xl py-8 sm:py-12">
            <header className="mb-8 sm:mb-12">
                <Hijackable
                    as="h1"
                    category="heading"
                    text="Civic Compliance Protocols"
                    className="font-display text-h1 text-text uppercase"
                />
                <p className="mt-2 text-small text-text-muted">
                    Approved for citizen consumption by Super Earth High Command
                </p>
                <p className="mt-1 text-small text-text-muted italic">
                    Last updated: April 2026
                </p>
            </header>

            {/* ── TERMS OF USE ──────────────────────────────── */}
            <section id="terms" className="scroll-mt-20">
                <Hijackable
                    as="h2"
                    category="heading"
                    text="Citizen Service Agreement"
                    className="font-display text-h2 text-primary uppercase"
                />
                <p className="mt-1 text-small text-text-muted italic">
                    Directive SE-7734 · Effective upon access · Ministry of Truth
                </p>

                <div className="mt-6 flex flex-col gap-4 text-body text-text">
                    <p>
                        By accessing this Ministry of Truth broadcast terminal, you hereby
                        affirm your status as a loyal citizen of Super Earth and agree to
                        the following terms of continued access. Failure to comply may
                        result in reclassification of your citizenship status.
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        Nature of This Broadcast
                    </h3>
                    <p>
                        This terminal is an independent, non-commercial fan project
                        operated by a private citizen. It is not affiliated with, endorsed
                        by, or connected to Arrowhead Game Studios or Sony Interactive
                        Entertainment. All game data is sourced from the official
                        Helldivers 1 API and rebroadcast for informational purposes.
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        No Guarantee of Service
                    </h3>
                    <p>
                        This broadcast is provided &ldquo;as is&rdquo; with no warranties
                        of any kind. Super Earth High Command cannot guarantee
                        uninterrupted service, data accuracy, or uptime. Campaign
                        intelligence may lag behind the official feed. Service may be
                        suspended at any time without notice.
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        Intellectual Property
                    </h3>
                    <p>
                        Helldivers, Super Earth, and all related names, logos, and imagery
                        are the property of Arrowhead Game Studios AB. This terminal uses
                        these elements under fair use as a non-commercial fan work. The
                        source code of this terminal is open and available on{' '}
                        <a
                            href="https://github.com/elfensky/helldivers.bot"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                        >
                            GitHub
                        </a>
                        .
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        API Access Protocols
                    </h3>
                    <p>
                        Authenticated citizens may access this terminal&apos;s API for
                        personal and non-commercial use. Commercial resale or
                        redistribution of intelligence data is prohibited. Rate limits are
                        enforced. Abuse of API access will result in immediate revocation
                        of credentials.
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        Citizen Accounts
                    </h3>
                    <p>
                        Registration is facilitated through Discord, GitHub or Google
                        authentication. Accounts may be suspended or terminated for abuse.
                        Citizens may delete their account at any time from the{' '}
                        <Link
                            href="/profile"
                            prefetch={false}
                            className="text-primary hover:underline"
                        >
                            profile page
                        </Link>
                        .
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        Amendments to This Directive
                    </h3>
                    <p>
                        High Command reserves the right to update these terms at any time.
                        Continued access to this terminal constitutes acceptance of any
                        modifications. The &ldquo;last updated&rdquo; date at the top of
                        this document will reflect the most recent revision.
                    </p>
                </div>
            </section>

            <SectionDivider />

            {/* ── PRIVACY POLICY ────────────────────────────── */}
            <section id="privacy" className="scroll-mt-20">
                <Hijackable
                    as="h2"
                    category="heading"
                    text="Bureau of Intelligence Data Protocols"
                    className="font-display text-h2 text-primary uppercase"
                />
                <div className="mt-6 flex flex-col gap-4 text-body text-text">
                    <p>
                        The privacy notice has its own page:{' '}
                        <Link
                            href="/privacy"
                            prefetch={false}
                            data-umami-event="legal-privacy"
                            className="text-primary hover:underline"
                        >
                            Privacy
                        </Link>
                        . It names who is responsible, what is collected and why, how long
                        it is kept, who else sees it, and your rights. Contact for privacy
                        matters: privacy@lav.ren.
                    </p>
                </div>
            </section>

            <SectionDivider />

            {/* ── COOKIES ───────────────────────────────────── */}
            <section id="cookies" className="scroll-mt-20">
                <Hijackable
                    as="h2"
                    category="heading"
                    text="Automated Tracking Rations"
                    className="font-display text-h2 text-primary uppercase"
                />
                <p className="mt-1 text-small text-text-muted italic">
                    Technical Bulletin TB-0042 · Department of Digital Logistics
                </p>

                <div className="mt-6 flex flex-col gap-4 text-body text-text">
                    <p>
                        Unlike certain hostile alien civilizations, Super Earth respects
                        the digital autonomy of its citizens. This terminal deploys
                        minimal tracking mechanisms — only what is strictly necessary for
                        operation.
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        Cookie Inventory
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-small">
                            <thead>
                                <tr className="border-b border-ghost text-left text-text-muted">
                                    <th className="pr-4 pb-2 font-mono font-normal">
                                        Designation
                                    </th>
                                    <th className="pr-4 pb-2 font-mono font-normal">
                                        Classification
                                    </th>
                                    <th className="pr-4 pb-2 font-mono font-normal">
                                        Purpose
                                    </th>
                                    <th className="pb-2 font-mono font-normal">
                                        Duration
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-ghost/50">
                                    <td className="py-2 pr-4 font-mono text-primary">
                                        better-auth.session_token
                                    </td>
                                    <td className="py-2 pr-4">HttpOnly, Secure</td>
                                    <td className="py-2 pr-4">
                                        Maintains your authenticated session
                                    </td>
                                    <td className="py-2">Until expiry or logout</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="text-small text-text-muted">
                        This cookie is set only when you sign in via Discord, GitHub or
                        Google. It is strictly necessary for authentication and requires
                        no consent.
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        Local Storage Requisitions
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-small">
                            <thead>
                                <tr className="border-b border-ghost text-left text-text-muted">
                                    <th className="pr-4 pb-2 font-mono font-normal">
                                        Designation
                                    </th>
                                    <th className="pb-2 font-mono font-normal">
                                        Purpose
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-ghost/50">
                                    <td className="py-2 pr-4 font-mono text-primary">
                                        hd1-live-cache-v1
                                    </td>
                                    <td className="py-2">
                                        Stores last campaign data for offline/PWA fallback
                                    </td>
                                </tr>
                                <tr className="border-b border-ghost/50">
                                    <td className="py-2 pr-4 font-mono text-primary">
                                        umami.disabled
                                    </td>
                                    <td className="py-2">
                                        Records your analytics opt-out. Set only when you
                                        press the transponder switch on the privacy page;
                                        removed when you re-enable analytics.
                                    </td>
                                </tr>
                                <tr className="border-b border-ghost/50">
                                    <td className="py-2 pr-4 font-mono text-primary">
                                        hd1.replay-consent
                                    </td>
                                    <td className="py-2">
                                        Records your answer to the session-recording
                                        prompt. Set only when you answer it, or change it
                                        on the privacy page.
                                    </td>
                                </tr>
                                <tr className="border-b border-ghost/50">
                                    <td className="py-2 pr-4 font-mono text-primary">
                                        hd1-prefs-snapshotted (session storage)
                                    </td>
                                    <td className="py-2">
                                        Notes that your display settings were counted once
                                        in this visit. Set only after you allow session
                                        recording; gone when you close the tab.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        What This Terminal Does Not Deploy
                    </h3>
                    <ul className="list-inside list-disc text-text-muted">
                        <li>No tracking cookies</li>
                        <li>No third-party cookies</li>
                        <li>No advertising cookies</li>
                        <li>No browser fingerprinting</li>
                    </ul>
                    <p>
                        The operational analytics system (Umami) sets no cookies and
                        stores nothing in your browser. The opt-out flag and the recording
                        answer above are your own choices, kept so the choice works.
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        Citizen Override Controls
                    </h3>
                    <p>
                        You may clear cookies and local storage from your browser at any
                        time. Clearing the session cookie will log you out. Clearing local
                        storage removes the offline campaign cache — it will repopulate
                        automatically on your next visit. It also removes the analytics
                        opt-out and your recording answer: analytics resume until you
                        press the switch again, and the recording prompt asks again.
                    </p>
                </div>
            </section>

            <SectionDivider />

            <footer className="text-center">
                <p className="text-small text-text-muted italic">
                    This document has been reviewed and approved by the Ministry of Truth.
                    <br />
                    For Managed Democracy. For Super Earth.
                </p>
                <Link
                    href="/"
                    prefetch={false}
                    className="mt-4 inline-block cursor-pointer border border-primary px-3 py-1.5 font-body text-small font-bold tracking-[0.02em] text-primary uppercase hover:bg-primary hover:text-surface-0"
                >
                    Resume approved broadcast
                </Link>
            </footer>
        </div>
    );
}
