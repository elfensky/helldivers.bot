import './brandkit.css';

export const metadata = {
    title: 'Brand Kit | Helldivers Bot',
    description:
        'Tactical Command Interface — design system reference for Helldivers Bot.',
    robots: { index: false, follow: false },
};

export default function BrandKitPage() {
    return (
        <div className="gutters brandkit py-8">
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
        <section className="bk-section">
            <p className="bk-meta">DESIGN_SYSTEM // TACTICAL_COMMAND_INTERFACE</p>
            <h1>Brand Kit</h1>
            <p className="bk-subtitle">
                Visual reference for the Tactical Command Interface. Tokens defined in{' '}
                <code>src/styles/tokens.css</code>.
            </p>
            <div className="bk-rules">
                <div className="bk-rule">
                    <span className="bk-rule-value">0px</span>
                    <span className="bk-rule-label">Radius — everywhere</span>
                </div>
                <div className="bk-rule">
                    <span className="bk-rule-value">RIGHT</span>
                    <span className="bk-rule-label">Accent line — always right</span>
                </div>
                <div className="bk-rule">
                    <span className="bk-rule-value">TONAL</span>
                    <span className="bk-rule-label">
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
        <section className="bk-section">
            <h2>Palette</h2>
            <div className="bk-palette">
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
                <Swatch
                    color="var(--color-ghost-border)"
                    name="Ghost"
                    token="--color-ghost-border"
                />
            </div>

            <h3>Surfaces</h3>
            <div className="bk-surfaces">
                {[0, 1, 2, 3, 4].map((n) => (
                    <div
                        key={n}
                        className="bk-surface"
                        style={{ background: `var(--color-surface-${n})` }}
                    >
                        <span>{n}</span>
                        <code>--color-surface-{n}</code>
                    </div>
                ))}
            </div>

            <h3>Factions</h3>
            <div className="bk-palette">
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
                <Swatch
                    color="var(--color-faction-superearth)"
                    name="Super Earth"
                    token="--color-faction-superearth"
                />
                <Swatch
                    color="var(--color-map-border)"
                    name="Map Border"
                    token="--color-map-border"
                />
            </div>
        </section>
    );
}

function Swatch({ color, name, token }) {
    return (
        <div className="bk-swatch">
            <div className="bk-swatch-color" style={{ backgroundColor: color }} />
            <div className="bk-swatch-info">
                <span>{name}</span>
                <code>{token}</code>
            </div>
        </div>
    );
}

/* ----------------------------------------------------------------
   3. Type & Spacing — Merged into one compact section
   ---------------------------------------------------------------- */
function TypeAndSpacing() {
    return (
        <section className="bk-section">
            <h2>Typography</h2>
            <div className="bk-type-grid">
                <div className="bk-type-sample">
                    <h1 style={{ margin: 0 }}>Current Campaign</h1>
                    <code>clamp(1.5rem, 1rem + 2vw, 2.5rem)</code>
                </div>
                <div className="bk-type-sample">
                    <h2 style={{ margin: 0 }}>Current Defend Events</h2>
                    <code>clamp(1.25rem, 0.9rem + 1.5vw, 1.875rem)</code>
                </div>
                <div className="bk-type-sample">
                    <h3 style={{ margin: 0 }}>Global Stats</h3>
                    <code>clamp(1.125rem, 0.9rem + 1vw, 1.5rem)</code>
                </div>
                <div className="bk-type-sample">
                    <h4 style={{ margin: 0 }}>Helldivers Discord</h4>
                    <code>clamp(1rem, 0.9rem + 0.5vw, 1.25rem)</code>
                </div>
                <div className="bk-type-sample">
                    <span>Bugs is active: 584/1000 (58.4%) current players: 332</span>
                    <code>clamp(0.875rem, 0.8rem + 0.35vw, 1.0625rem)</code>
                </div>
                <div className="bk-type-sample">
                    <small>Finished 10 hours, 43 minutes ago</small>
                    <code>clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)</code>
                </div>
            </div>

            <div className="bk-font-row">
                <div>
                    <span className="bk-meta">DISPLAY</span>
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
                <div>
                    <span className="bk-meta">BODY</span>
                    <span style={{ fontFamily: 'var(--font-body)' }}>
                        Insignia / Inter / Arial
                    </span>
                </div>
                <div>
                    <span className="bk-meta">MONO</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Space Mono</span>
                </div>
            </div>

            <h3>Spacing</h3>
            <div className="bk-spacing">
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
                    <div className="bk-space-item" key={token}>
                        <div
                            className="bk-space-bar"
                            style={{ width: `var(${token})` }}
                        />
                        <code>{token}</code>
                        <span>{px}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}

/* ----------------------------------------------------------------
   4. Components — Live demos
   ---------------------------------------------------------------- */
function Components() {
    return (
        <section className="bk-section">
            <h2>Components</h2>

            <div className="bk-comp-row">
                <button className="btn-demo btn-primary">Deploy</button>
                <button className="btn-demo btn-ghost">Cancel</button>
                <button className="btn-demo btn-danger">Abort</button>
                <button className="btn-demo btn-primary btn-disabled" disabled>
                    Disabled
                </button>
            </div>

            <h3>Data Cards</h3>
            <p className="bk-note">
                4px right-side accent. Grid layout for swappable variants.
            </p>
            <div className="bk-card-grid">
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

            <h3>Alert</h3>
            <div className="demo-alert">
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

            <h3>Progress</h3>
            <div style={{ maxWidth: '400px' }}>
                <div className="demo-progress-track">
                    <div className="demo-progress-fill" style={{ width: '58.4%' }} />
                </div>
                <code className="bk-note">584 / 1,000 (58.40%)</code>
            </div>
        </section>
    );
}

function DataCard({ label, stat, desc, accent = 'default' }) {
    const cls =
        accent === 'default' ? 'data-card-accent' : (
            `data-card-accent data-card-accent--${accent}`
        );
    return (
        <div className="data-card">
            <div className="data-card-content">
                <div className="bk-meta">{label}</div>
                <div className="data-card-stat">{stat}</div>
                <p className="data-card-desc">{desc}</p>
            </div>
            <div className={cls} />
        </div>
    );
}
