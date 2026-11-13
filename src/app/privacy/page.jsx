import Link from 'next/link';
import AnalyticsOptOut from '@/shared/components/AnalyticsOptOut';
import ReplayChoice from '@/features/consent/ReplayChoice';

export const metadata = {
    title: 'Privacy',
    description:
        'Who processes your data on helldivers.bot, what is collected, why, for how long, and your rights.',
    alternates: { canonical: '/privacy' },
};

const CONTACT = 'privacy@lav.ren';
const LAST_UPDATED = { iso: '2026-11-14', text: '14 November 2026' };

/**
 * A fact the repository cannot prove, shown in the page until the owner fills it.
 *
 * @param {{ children: import('react').ReactNode }} props - The missing fact.
 * @returns {import('react').ReactElement}
 */
function Unconfirmed({ children }) {
    return (
        <mark className="bg-warning-tint px-1 font-mono text-small text-warning">
            [{children}]
        </mark>
    );
}

/**
 * @param {{ id: string, title: string, children: import('react').ReactNode }} props - Anchor id, heading and body.
 * @returns {import('react').ReactElement}
 */
function Section({ id, title, children }) {
    return (
        <section id={id} className="flex scroll-mt-20 flex-col gap-3">
            <h2 className="font-display text-h2 text-primary uppercase">{title}</h2>
            {children}
        </section>
    );
}

const mail = (
    <a
        href={`mailto:${CONTACT}`}
        data-umami-event="privacy-contact"
        className="text-primary hover:underline"
    >
        {CONTACT}
    </a>
);

const linkClass = 'text-primary hover:underline';

/**
 * The privacy notice (GDPR Art. 13), from the analytics-standard template (#619).
 * It describes the consent controls of #617: the recording prompt, the two signup
 * boxes and the profile switch.
 */
export default function PrivacyPage() {
    return (
        <div className="gutters mx-auto flex max-w-3xl flex-col gap-10 py-8 text-body text-text sm:py-12">
            <header className="flex flex-col gap-2">
                <h1 className="font-display text-h1 text-text uppercase">Privacy</h1>
                <p className="text-small text-text-muted">
                    This page says who handles your data on helldivers.bot, what is
                    collected, why, for how long, and what you can do about it. The rest
                    of the site keeps the Super Earth tone; this page does not.
                </p>
            </header>

            <Section id="controller" title="Who is responsible">
                <p>
                    Andrei Lavrenov, a private person who runs this site as a
                    non-commercial fan project, is the controller. Contact: {mail}. This
                    is the only contact route for privacy matters.
                </p>
            </Section>

            <Section id="measured" title="What is measured without asking you">
                <p>
                    For each visit: the page address, the page title, the referring
                    address, screen size, browser language, browser, operating system,
                    device type, an approximate location (country, region and city, looked
                    up from your IP address), how fast the page loaded (TTFB, FCP, LCP,
                    CLS, INP) and the names of the buttons you press. Visits are grouped
                    by a hash of your IP address and browser, which changes{' '}
                    <Unconfirmed>
                        every day — confirm SALT_ROTATION=day on the Umami server
                    </Unconfirmed>
                    . That hash is <strong>pseudonymous, not anonymous</strong>, and the
                    law treats it as personal data. Requests to the public API are counted
                    on our server, without your IP address.
                </p>
                <p>
                    This runs on our own Umami server. Legal basis: our legitimate
                    interest in knowing which pages are used, how fast they load and where
                    they break, so the site can be kept working and improved (GDPR Art.
                    6(1)(f)). No cookies are set for it. The only values stored in your
                    browser are your own choices under{' '}
                    <a
                        href="#choices"
                        data-umami-event="privacy-choices"
                        className={linkClass}
                    >
                        Your choices
                    </a>
                    .
                </p>
            </Section>

            <Section id="consent" title="What happens only if you agree">
                <p>
                    <strong>Session recording.</strong> Only if you press &ldquo;Allow
                    recording&rdquo; in the Ministry of Truth prompt at the bottom of the
                    page, or switch it on below. Your visits may then be recorded to find
                    where the site is hard to use. All text on the page and everything you
                    type is masked in your browser before anything is sent; the layout,
                    images, your clicks, pointer positions and scrolling are recorded. A
                    recording is never linked to an account: it does not run while the
                    account link below is on. With the same yes, the site notes once per
                    visit which display settings you use (faction, regions view and sort
                    order). &ldquo;Decline&rdquo; is as easy as &ldquo;Allow&rdquo;, and
                    nothing is recorded until you allow it.
                </p>
                <p>
                    <strong>Account link.</strong> Only if you tick &ldquo;The Ministry of
                    Truth wants to know who you are&rdquo; when you sign up or accept the
                    terms, or switch &ldquo;Link my use of this site to my account&rdquo;
                    on in your{' '}
                    <Link
                        href="/profile"
                        prefetch={false}
                        data-umami-event="privacy-profile"
                        className={linkClass}
                    >
                        profile
                    </Link>
                    . The pages you visit and the buttons you use are then linked to your
                    account id and your sign-in provider in our own analytics, so that a
                    problem you report can be traced in your visits. The box is empty
                    until you tick it. Switching it off on your profile page withdraws the
                    consent and deletes the visits linked to your account at once.
                </p>
                <p>
                    <strong>Push notifications.</strong> Only if you turn them on and your
                    browser asks your permission. We store your browser&apos;s
                    subscription address and its keys to send game alerts, and nothing
                    else. They are deleted when you turn notifications off, or when the
                    push service reports that the subscription has ended.
                </p>
                <p>
                    Legal basis for all three: your consent (GDPR Art. 6(1)(a); Art. 10/2
                    of the Belgian Law of 30 July 2018). You can withdraw it at any time,
                    as easily as you gave it. Withdrawal does not make earlier processing
                    unlawful.
                </p>
            </Section>

            <Section id="account" title="Your account">
                <p>
                    You need an account only for API keys and the profile page; every
                    other part of the site works without one. When you sign in with
                    Discord, GitHub or Google, we receive and store your name, email
                    address, avatar address and account id at that provider, and the
                    access, refresh and ID tokens the provider issues. We also store your
                    API keys (as a hash), your settings, the date you accepted the terms
                    and the state of the account link. If the provider gives no avatar,
                    our server fetches one from Gravatar with a SHA-256 hash of your email
                    address.
                </p>
                <p>
                    Each sign-in keeps a session cookie in your browser and a session
                    record with the IP address and browser you signed in with. The session
                    ends when you sign out, or 7 days after its last use.
                </p>
                <p>
                    Legal basis: the terms of service you accept (GDPR Art. 6(1)(b)). We
                    keep the account until you delete it on the profile page; deleting it
                    removes all of the above, and the visits linked to it.
                </p>
            </Section>

            <Section id="errors" title="Error tracking and abuse protection">
                <p>
                    When the site fails, our own GlitchTip server receives an error
                    report: the error, the page address, browser and operating system, and
                    it may include your IP address. A sample of page loads also sends
                    timing data. If the deletion of linked visits fails, the report holds
                    your account id so that we can finish the deletion by hand. Legal
                    basis: our legitimate interest in finding and fixing faults (GDPR Art.
                    6(1)(f)).
                </p>
                <p>
                    To limit abuse, the public API and the notification sign-up count
                    requests per IP address. Those counters are deleted after about two
                    hours. Legal basis: our legitimate interest in keeping the service
                    available (GDPR Art. 6(1)(f), Recital 49).
                </p>
            </Section>

            <Section id="signals" title="Your browser's privacy signals">
                <p>
                    If your browser sends Global Privacy Control or Do Not Track, session
                    recording, the display-settings note and the account link never run,
                    whatever you chose before, and the recording prompt does not appear.
                    The visit counting described above does not read these signals yet: to
                    stop it, use the switch under{' '}
                    <a
                        href="#choices"
                        data-umami-event="privacy-choices"
                        className={linkClass}
                    >
                        Your choices
                    </a>
                    .
                </p>
            </Section>

            <Section id="not" title="What we do not do">
                <p>
                    No advertising, no profiling for marketing, no sale or sharing of
                    data, no tracking across other websites, and no automated decisions
                    that affect you.
                </p>
            </Section>

            <Section id="logs" title="Server logs">
                <p>
                    Our servers may record the IP address of a request for up to{' '}
                    <Unconfirmed>LOG RETENTION — not set in the repository</Unconfirmed>,
                    to protect the site against attacks and abuse. This rests on our
                    legitimate interest in keeping the site secure (GDPR Art. 6(1)(f),
                    Recital 49). These logs are kept apart from the measurement above and
                    are never combined with it.
                </p>
            </Section>

            <Section id="recipients" title="Who else sees it">
                <ul className="flex list-inside list-disc flex-col gap-2">
                    <li>
                        Hetzner, which hosts our servers and database in{' '}
                        <Unconfirmed>HOSTING LOCATION</Unconfirmed>.
                    </li>
                    <li>
                        Cloudflare, which carries every request to our servers and so sees
                        your IP address.
                    </li>
                    <li>
                        Our own Umami (analytics) and GlitchTip (error tracking) servers,
                        in <Unconfirmed>ANALYTICS SERVER LOCATION</Unconfirmed>. No one
                        else receives that data.
                    </li>
                    <li>Discord, GitHub or Google, only for the sign-in you choose.</li>
                    <li>Gravatar (Automattic), for the avatar described above.</li>
                    <li>
                        The push service of your browser&apos;s maker (for example Google,
                        Mozilla, Apple or Microsoft), which delivers notifications if you
                        turned them on.
                    </li>
                </ul>
                <p>
                    Cloudflare, Discord, GitHub, Google, Automattic and the browser push
                    services are based in the United States, so data can go outside the
                    European Economic Area. Safeguard:{' '}
                    <Unconfirmed>
                        TRANSFER SAFEGUARD — EU-US Data Privacy Framework or standard
                        contractual clauses, per provider
                    </Unconfirmed>
                    .
                </p>
            </Section>

            <Section id="retention" title="How long it is kept">
                <ul className="flex list-inside list-disc flex-col gap-2">
                    <li>
                        Visit records:{' '}
                        <Unconfirmed>
                            13 months, then only monthly totals that identify no one —
                            confirm the retention job runs on the Umami server
                        </Unconfirmed>
                        .
                    </li>
                    <li>
                        Recordings:{' '}
                        <Unconfirmed>
                            30 days — confirm the retention job runs on the Umami server
                        </Unconfirmed>
                        .
                    </li>
                    <li>Visits linked to an account: until you switch the link off.</li>
                    <li>
                        Error reports: <Unconfirmed>GLITCHTIP RETENTION</Unconfirmed>.
                    </li>
                    <li>
                        Server logs: <Unconfirmed>LOG RETENTION</Unconfirmed>.
                    </li>
                    <li>Abuse counters: about two hours.</li>
                    <li>Sign-in sessions: until sign-out, or 7 days after last use.</li>
                    <li>Account data: until you delete the account.</li>
                    <li>Push subscriptions: until you turn notifications off.</li>
                </ul>
                <p>
                    Deleted data stays in our backups for up to{' '}
                    <Unconfirmed>BACKUP WINDOW</Unconfirmed> before it is gone.
                </p>
            </Section>

            <Section id="rights" title="Your rights">
                <p>
                    You can ask for access to your data, its correction, its deletion,
                    restriction of its use and a portable copy, and you can object to its
                    use. You can withdraw a consent at any time. Write to {mail}; you get
                    an answer within one month (GDPR Art. 12(3)). Signed in, you can also
                    download your data and delete your account yourself on the{' '}
                    <Link
                        href="/profile"
                        prefetch={false}
                        data-umami-event="privacy-profile"
                        className={linkClass}
                    >
                        profile page
                    </Link>
                    .
                </p>
                <blockquote className="border-l-2 border-primary pl-4">
                    <strong>Your right to object.</strong> The measurement above rests on
                    our legitimate interest, so you may object at any time, and we stop.
                    The switch below does it for this browser.
                </blockquote>
                <p>
                    If you think we handle your data wrongly, you can complain to the
                    Belgian data protection authority: Gegevensbeschermingsautoriteit /
                    Autorité de protection des données, Drukpersstraat 35, 1000 Brussel,
                    contact@apd-gba.be.
                </p>
            </Section>

            <Section id="choices" title="Your choices">
                <h3 className="text-h3 font-bold text-text uppercase">Counting</h3>
                <AnalyticsOptOut />
                <h3 className="text-h3 font-bold text-text uppercase">
                    Session recording
                </h3>
                <ReplayChoice />
                <h3 className="text-h3 font-bold text-text uppercase">Account link</h3>
                <p>
                    Signed in, use the switch on your{' '}
                    <Link
                        href="/profile"
                        prefetch={false}
                        data-umami-event="privacy-profile"
                        className={linkClass}
                    >
                        profile page
                    </Link>
                    .
                </p>
                <p className="text-small text-text-muted">
                    The counting and recording choices are stored in this browser only.
                    Stopping recording takes effect at once and reloads the page.
                </p>
            </Section>

            <p className="text-small text-text-muted italic">
                Last updated <time dateTime={LAST_UPDATED.iso}>{LAST_UPDATED.text}</time>.
                The{' '}
                <Link
                    href="/legal"
                    prefetch={false}
                    data-umami-event="privacy-legal"
                    className={linkClass}
                >
                    terms of service
                </Link>{' '}
                are on the legal page.
            </p>
        </div>
    );
}
