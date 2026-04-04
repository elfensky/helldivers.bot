export const metadata = {
    title: 'Brand Kit | Helldivers Bot',
    description:
        'Tactical Command Interface — design system reference for Helldivers Bot.',
    alternates: { canonical: '/docs/brandkit' },
    openGraph: { url: '/docs/brandkit' },
    robots: { index: false, follow: false },
};

export default function BrandKitPage() {
    return (
        <div className="max-w-full overflow-hidden">
            <Hero />
            <Palette />
            <TypeAndSpacing />
            <Components />
        </div>
    );
}

/* ----------------------------------------------------------------
   1. Hero — System identity + core rules
   ---------------------------------------------------------------- */
function Hero() {
    return (
        <section className="mb-10">
            <h6 className="text-text-muted">
                Design System // Tactical Command Interface
            </h6>
            <h1>Brand Kit</h1>
            <p className="mb-4 max-w-[600px]">
                Visual reference for the Tactical Command Interface. Tokens defined in{' '}
                <code>src/app/layout.css</code>.
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
                <div className="flex min-w-[140px] flex-1 flex-col border border-ghost bg-surface-1 px-4 py-3">
                    <span className="font-display text-2xl leading-none font-black text-primary uppercase">
                        0px
                    </span>
                    <span className="mt-1 text-xs text-text-muted">
                        Radius — everywhere
                    </span>
                </div>
                <div className="flex min-w-[140px] flex-1 flex-col border border-ghost bg-surface-1 px-4 py-3">
                    <span className="font-display text-2xl leading-none font-black text-primary uppercase">
                        RIGHT
                    </span>
                    <span className="mt-1 text-xs text-text-muted">
                        Accent line — always right
                    </span>
                </div>
                <div className="flex min-w-[140px] flex-1 flex-col border border-ghost bg-surface-1 px-4 py-3">
                    <span className="font-display text-2xl leading-none font-black text-primary uppercase">
                        TONAL
                    </span>
                    <span className="mt-1 text-xs text-text-muted">
                        Depth — surface shifts, no shadows
                    </span>
                </div>
            </div>
        </section>
    );
}

/* ----------------------------------------------------------------
   2. Palette — All colors in one dense grid
   ---------------------------------------------------------------- */
function Palette() {
    return (
        <section className="mb-10">
            <h2 className="mb-4 border-b border-outline-variant pb-1 text-primary">
                Palette
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                <Swatch
                    color="var(--color-primary)"
                    name="Primary"
                    token="--color-primary"
                />
                <Swatch
                    color="var(--color-danger)"
                    name="Danger"
                    token="--color-danger"
                />
                <Swatch
                    color="var(--color-on-primary)"
                    name="On Primary"
                    token="--color-on-primary"
                />
                <Swatch color="var(--color-text)" name="Text" token="--color-text" />
                <Swatch
                    color="var(--color-text-muted)"
                    name="Text Muted"
                    token="--color-text-muted"
                />
                <Swatch
                    color="var(--color-outline)"
                    name="Outline"
                    token="--color-outline"
                />
                <Swatch
                    color="var(--color-outline-variant)"
                    name="Outline Var"
                    token="--color-outline-variant"
                />
                <Swatch color="var(--color-ghost)" name="Ghost" token="--color-ghost" />
            </div>

            <h3 className="mt-6 mb-2">Surfaces</h3>
            <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4].map((n) => (
                    <div
                        key={n}
                        className="min-w-[80px] flex-1 border border-ghost p-2 text-center text-xs"
                        style={{ background: `var(--color-surface-${n})` }}
                    >
                        <span className="block font-bold text-text">{n}</span>
                        <code className="font-mono text-[0.5rem] text-text-muted">
                            --color-surface-{n}
                        </code>
                    </div>
                ))}
            </div>

            <h3 className="mt-6 mb-2">Factions</h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                <Swatch
                    color="var(--color-faction-bugs)"
                    name="Bugs"
                    token="--color-faction-bugs"
                />
                <Swatch
                    color="var(--color-faction-bugs-fill)"
                    name="Bugs Fill"
                    token="--color-faction-bugs-fill"
                />
                <Swatch
                    color="var(--color-faction-cyborgs)"
                    name="Cyborgs"
                    token="--color-faction-cyborgs"
                />
                <Swatch
                    color="var(--color-faction-cyborgs-fill)"
                    name="Cyborgs Fill"
                    token="--color-faction-cyborgs-fill"
                />
                <Swatch
                    color="var(--color-faction-illuminate)"
                    name="Illuminate"
                    token="--color-faction-illuminate"
                />
                <Swatch
                    color="var(--color-faction-illuminate-fill)"
                    name="Illum. Fill"
                    token="--color-faction-illuminate-fill"
                />
            </div>
        </section>
    );
}

function Swatch({ color, name, token }) {
    return (
        <div className="border border-ghost">
            <div className="h-12" style={{ backgroundColor: color }} />
            <div className="bg-surface-2 px-1.5 py-1 text-xs leading-[1.3]">
                <span className="block font-body">{name}</span>
                <code className="block font-mono text-[0.5625rem] text-text-muted">
                    {token}
                </code>
            </div>
        </div>
    );
}

/* ----------------------------------------------------------------
   3. Type & Spacing — Merged into one compact section
   ---------------------------------------------------------------- */
function TypeAndSpacing() {
    return (
        <section className="mb-10">
            <h2 className="mb-4 border-b border-outline-variant pb-1 text-primary">
                Typography
            </h2>
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline gap-4 border-b border-outline-variant py-2">
                    <h1 style={{ margin: 0 }}>Current Campaign</h1>
                    <code className="font-mono text-[0.5625rem] whitespace-nowrap text-text-muted">
                        clamp(1.5rem, 1rem + 2vw, 2.5rem)
                    </code>
                </div>
                <div className="flex flex-wrap items-baseline gap-4 border-b border-outline-variant py-2">
                    <h2 style={{ margin: 0 }}>Current Defend Events</h2>
                    <code className="font-mono text-[0.5625rem] whitespace-nowrap text-text-muted">
                        clamp(1.25rem, 0.9rem + 1.5vw, 1.875rem)
                    </code>
                </div>
                <div className="flex flex-wrap items-baseline gap-4 border-b border-outline-variant py-2">
                    <h3 style={{ margin: 0 }}>Global Stats</h3>
                    <code className="font-mono text-[0.5625rem] whitespace-nowrap text-text-muted">
                        clamp(1.125rem, 0.9rem + 1vw, 1.5rem)
                    </code>
                </div>
                <div className="flex flex-wrap items-baseline gap-4 border-b border-outline-variant py-2">
                    <h4 style={{ margin: 0 }}>Helldivers Discord</h4>
                    <code className="font-mono text-[0.5625rem] whitespace-nowrap text-text-muted">
                        clamp(1rem, 0.9rem + 0.5vw, 1.25rem)
                    </code>
                </div>
                <div className="flex flex-wrap items-baseline gap-4 border-b border-outline-variant py-2">
                    <span>Bugs is active: 584/1000 (58.4%) current players: 332</span>
                    <code className="font-mono text-[0.5625rem] whitespace-nowrap text-text-muted">
                        clamp(0.875rem, 0.8rem + 0.35vw, 1.0625rem)
                    </code>
                </div>
                <div className="flex flex-wrap items-baseline gap-4 border-b border-outline-variant py-2">
                    <small>Finished 10 hours, 43 minutes ago</small>
                    <code className="font-mono text-[0.5625rem] whitespace-nowrap text-text-muted">
                        clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)
                    </code>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-6 border border-ghost bg-surface-1 p-3">
                <div className="flex flex-col gap-0.5">
                    <h6 className="text-text-muted">Display</h6>
                    <span
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 900,
                            textTransform: 'uppercase',
                        }}
                    >
                        Insignia / Space Grotesk
                    </span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <h6 className="text-text-muted">Body</h6>
                    <span style={{ fontFamily: 'var(--font-body)' }}>
                        Insignia / Inter / Arial
                    </span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <h6 className="text-text-muted">Mono</h6>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Space Mono</span>
                </div>
            </div>

            <h3 className="mt-6 mb-2">Spacing</h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-1">
                {[
                    ['--space-1', '4px'],
                    ['--space-2', '6.4px'],
                    ['--space-3', '8px'],
                    ['--space-4', '12px'],
                    ['--space-6', '16px'],
                    ['--space-8', '24px'],
                    ['--space-10', '36px'],
                    ['--space-12', '48px'],
                ].map(([token, px]) => (
                    <div className="flex items-center gap-2" key={token}>
                        <div
                            className="h-4 shrink-0 bg-primary opacity-50"
                            style={{ width: `var(${token})` }}
                        />
                        <code className="font-mono text-[0.625rem] text-text-muted">
                            {token}
                        </code>
                        <span className="text-[0.625rem] text-text-muted">{px}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}

/* ----------------------------------------------------------------
   4. Components — Live demos
   ---------------------------------------------------------------- */
const btn =
    'inline-block py-1.5 px-3 font-body font-bold text-[0.8125rem] uppercase tracking-[0.02em] border-none cursor-pointer';

function Components() {
    return (
        <section className="mb-10">
            <h2 className="mb-4 border-b border-outline-variant pb-1 text-primary">
                Components
            </h2>

            <div className="mb-4 flex flex-wrap gap-2">
                <button className={`${btn} bg-primary text-on-primary`}>Deploy</button>
                <button
                    className={`${btn} border border-primary bg-transparent text-primary`}
                >
                    Cancel
                </button>
                <button className={`${btn} bg-danger text-white`}>Abort</button>
                <button
                    className={`${btn} cursor-not-allowed bg-primary text-on-primary opacity-40`}
                    disabled
                >
                    Disabled
                </button>
            </div>

            <h3 className="mt-6 mb-2">Data Cards</h3>
            <p className="mb-2 block text-xs text-text-muted">
                4px right-side accent. Grid layout for swappable variants.
            </p>
            <div className="mb-4 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">
                <DataCard
                    label="CAMPAIGN_STATUS // LIVE"
                    stat="332"
                    desc="Helldivers Online"
                />
                <DataCard
                    label="DEFEND_EVENT // ACTIVE"
                    stat="584 / 1,000"
                    desc="Defending on Bugs — Due in 12:34:56"
                    accent="danger"
                />
                <DataCard
                    label="SEASON_STATS // BUGS"
                    stat="69.1B"
                    desc="Missions completed"
                    accent="bugs"
                />
            </div>

            <h3 className="mt-6 mb-2">Alert</h3>
            <div className="mb-4 animate-[alert-pulse_2s_infinite] border-3 border-danger bg-danger-tint p-3">
                <h4 style={{ margin: 0, color: 'white' }}>Active Defend Event</h4>
                <p
                    style={{
                        margin: 0,
                        marginTop: 'var(--space-2)',
                        color: 'rgba(255,255,255,0.85)',
                    }}
                >
                    Defending on Bugs: 584/1,000 (58.40%) — Ahead by 42 points. Due in
                    12:34:56.
                </p>
            </div>

            <h3 className="mt-6 mb-2">Progress</h3>
            <div style={{ maxWidth: '400px' }}>
                <div className="mb-1 h-3.5 bg-danger">
                    <div className="h-full bg-primary" style={{ width: '58.4%' }} />
                </div>
                <code className="mb-2 block text-xs text-text-muted">
                    584 / 1,000 (58.40%)
                </code>
            </div>
        </section>
    );
}

const accentColors = {
    default: 'bg-primary',
    danger: 'bg-danger',
    bugs: 'bg-faction-bugs',
    cyborgs: 'bg-faction-cyborgs',
    illuminate: 'bg-faction-illuminate',
    muted: 'bg-outline-variant',
};

function DataCard({ label, stat, desc, accent = 'default' }) {
    return (
        <div className="grid grid-cols-[1fr_4px] border border-ghost bg-surface-1 transition-colors hover:bg-surface-2">
            <div className="p-3">
                <h6 className="text-text-muted">{label}</h6>
                <div className="my-1 font-display text-2xl leading-none font-black text-primary uppercase">
                    {stat}
                </div>
                <p className="m-0 text-xs text-text-muted">{desc}</p>
            </div>
            <div className={accentColors[accent]} />
        </div>
    );
}
