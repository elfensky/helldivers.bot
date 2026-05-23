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
                        Registration is facilitated through Discord or GitHub
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
                <p className="mt-1 text-small text-text-muted italic">
                    Classification: PUBLIC · Clearance: CITIZEN · Bureau of Digital
                    Intelligence
                </p>

                <div className="mt-6 flex flex-col gap-4 text-body text-text">
                    <p>
                        The Ministry of Truth operates a surveillance-free intelligence
                        network. Unlike certain hostile civilizations, Super Earth
                        respects the digital autonomy of its citizens. All monitoring
                        infrastructure is self-hosted on Ministry-controlled servers. No
                        intelligence is sold, traded, or shared with third parties,
                        advertising networks, or data brokers.
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        Operational Analytics
                    </h3>
                    <p>
                        This terminal employs a self-hosted analytics system (Umami) to
                        monitor operational efficiency. This system is entirely cookieless
                        — it identifies sessions using a one-way hash of your IP address,
                        browser user-agent, and hostname. No personal data is stored. Page
                        views and interaction events are tracked in aggregate for internal
                        use only. Analytics are active in production environments only.
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        Authenticated Citizen Analytics
                    </h3>
                    <p>
                        When you are logged in, your internal citizen ID and
                        authentication provider (Discord or GitHub) are linked to your
                        analytics session. This allows the Ministry to understand how
                        authenticated citizens use the terminal. This data is used for
                        internal operational analysis only and is never shared externally.
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        Authentication Intelligence
                    </h3>
                    <p>
                        Signing in via Discord or GitHub provides this terminal with your
                        username, avatar URL, and provider account ID. This data is stored
                        in a Ministry-controlled database. Your session is maintained via
                        a secure, HttpOnly cookie. You may unlink authentication providers
                        or delete your account entirely from the{' '}
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
                        Stability Monitoring
                    </h3>
                    <p>
                        A self-hosted error tracking system (GlitchTip) collects crash
                        reports when the terminal malfunctions. These reports may include
                        device information, IP address, and browser user-agent. This data
                        is used solely to diagnose and repair technical failures. Session
                        tracking is disabled.
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        Push Alert Subscriptions
                    </h3>
                    <p>
                        When you enable push notifications, your browser&apos;s
                        subscription endpoint is stored in the database to deliver game
                        event alerts. This subscription is deleted immediately when you
                        disable notifications. It is used for no other purpose.
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        Data Retention Protocols
                    </h3>
                    <p>
                        Account data persists while your account exists. Analytics data is
                        aggregated and anonymized by the analytics system. Error reports
                        are retained per standard stability monitoring practices. Push
                        notification subscriptions are deleted on unsubscribe.
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        Citizen Rights
                    </h3>
                    <p>
                        You may delete your account from the profile page at any time.
                        This triggers a cascading deletion of all associated data. You may
                        disable push notifications at any time. Analytics data cannot be
                        traced back to you without an authenticated session.
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        Contact the Operator
                    </h3>
                    <p>
                        Inquiries may be directed through{' '}
                        <a
                            href="https://github.com/elfensky/helldivers.bot"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                        >
                            GitHub
                        </a>{' '}
                        or the operator&apos;s{' '}
                        <a
                            href="https://lav.ren"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                        >
                            portfolio
                        </a>
                        .
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
                        This cookie is set only when you sign in via Discord or GitHub. It
                        is strictly necessary for authentication and requires no consent.
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
                        The operational analytics system (Umami) is entirely cookieless.
                        It does not store any data in your browser.
                    </p>

                    <h3 className="text-h3 font-bold text-text uppercase">
                        Citizen Override Controls
                    </h3>
                    <p>
                        You may clear cookies and local storage from your browser at any
                        time. Clearing the session cookie will log you out. Clearing local
                        storage removes the offline campaign cache — it will repopulate
                        automatically on your next visit.
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
