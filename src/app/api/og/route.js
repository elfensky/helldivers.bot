import { ImageResponse } from 'next/og';
import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { computeMapState } from '@/utils/computeMapState.mjs';
import { tryCatch } from '@/utils/tryCatch.mjs';
import {
    bugPaths,
    cyborgPaths,
    illuminatePaths,
    superEarthCircle,
    viewBox,
} from '@/enums/mapPaths.mjs';

const COLORS = {
    bg: 'rgb(0, 9, 19)',
    border: 'rgba(255, 225, 0, 0.99)',
    captured: 'rgba(255, 213, 0, 0.33)',
    lost: 'rgba(255, 255, 255, 0.06)',
    lostStroke: 'rgba(255, 255, 255, 0.15)',
    bugs: 'rgba(232, 130, 42, 0.35)',
    bugsText: 'rgba(232, 130, 42, 0.9)',
    bugsBar: 'rgba(232, 130, 42, 0.7)',
    cyborgs: 'rgba(139, 45, 45, 0.35)',
    cyborgsText: 'rgba(139, 45, 45, 0.9)',
    cyborgsBar: 'rgba(139, 45, 45, 0.7)',
    illuminate: 'rgba(126, 200, 227, 0.35)',
    illuminateText: 'rgba(126, 200, 227, 0.9)',
    illuminateBar: 'rgba(126, 200, 227, 0.7)',
    yellow: 'rgba(255, 225, 0, 0.99)',
    textDim: 'rgba(255, 255, 255, 0.5)',
    textMuted: 'rgba(255, 255, 255, 0.4)',
    barBg: 'rgba(255, 255, 255, 0.1)',
};

const FACTION_NAMES = ['BUGS', 'CYBORGS', 'ILLUMINATE'];
const FACTION_FILL = [COLORS.bugs, COLORS.cyborgs, COLORS.illuminate];
const FACTION_TEXT = [COLORS.bugsText, COLORS.cyborgsText, COLORS.illuminateText];
const FACTION_BAR = [COLORS.bugsBar, COLORS.cyborgsBar, COLORS.illuminateBar];
const FACTION_PATHS = [bugPaths, cyborgPaths, illuminatePaths];

const CACHE_HEADERS = {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
};

function getSectorFill(status, factionIndex) {
    if (status === 'captured') return COLORS.captured;
    if (status === 'lost') return COLORS.lost;
    return FACTION_FILL[factionIndex] || COLORS.lost;
}

function getSectorStroke(status) {
    return status === 'lost' ? COLORS.lostStroke : COLORS.border;
}

function fallbackImage() {
    return new ImageResponse(
        <div
            style={{
                display: 'flex',
                width: '100%',
                height: '100%',
                background: COLORS.bg,
                color: 'white',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
            }}
        >
            helldivers.bot
        </div>,
        { width: 1200, height: 630, headers: CACHE_HEADERS },
    );
}

function buildMapSvg(mapState) {
    const paths = [];

    for (let fi = 0; fi < FACTION_PATHS.length; fi++) {
        for (const path of FACTION_PATHS[fi]) {
            const status = mapState[fi]?.[path.sector]?.status || 'lost';
            const fill = getSectorFill(status, fi);
            const stroke = getSectorStroke(status);
            paths.push(
                `<path d="${path.d}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`,
            );
        }
    }

    paths.push(
        `<circle cx="${superEarthCircle.cx}" cy="${superEarthCircle.cy}" r="${superEarthCircle.r}" fill="${COLORS.captured}" stroke="${COLORS.border}" stroke-width="2"/>`,
    );

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${paths.join('')}</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export async function GET() {
    const { data, error } = await tryCatch(getCampaign());

    if (error || !data || !data.live || data.live.length === 0) {
        return fallbackImage();
    }

    const events = data.events || [];
    const mapState = computeMapState(data.live, events);
    const mapDataUri = buildMapSvg(mapState);

    const factionStats = data.live.map((f) => {
        const idx = f.enemy;
        return {
            name: FACTION_NAMES[idx] || `FACTION ${idx}`,
            percent: f.points_max > 0 ? Math.round((f.points / f.points_max) * 100) : 0,
            textColor: FACTION_TEXT[idx] || COLORS.textDim,
            barColor: FACTION_BAR[idx] || COLORS.textDim,
            enemy: idx,
        };
    });

    // Determine status from live data and events
    let statusText = 'WAR IN PROGRESS';
    let statusColor = COLORS.yellow;

    const allDefeated =
        data.live.length === 3 && data.live.every((f) => f.status === 'defeated');
    if (allDefeated) {
        statusText = 'VICTORY';
    } else if (events.length > 0) {
        const activeEvent = events.find((e) => e.status === 'active');
        if (activeEvent) {
            statusText = 'ACTIVE EVENT';
        } else {
            const lastEvent = events.toSorted((a, b) => b.end_time - a.end_time)[0];
            const won = lastEvent.status === 'success';
            const verb = lastEvent.type === 'defend' ? 'DEFEND' : 'ATTACK';
            statusText = won ? `${verb} WON` : `${verb} LOST`;
            statusColor = won ? COLORS.yellow : COLORS.cyborgsText;
        }
    }

    return new ImageResponse(
        <div
            style={{
                display: 'flex',
                width: '100%',
                height: '100%',
                background: COLORS.bg,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    width: '60%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'absolute',
                        left: 24,
                        top: 24,
                    }}
                >
                    <span
                        style={{
                            fontSize: 18,
                            color: COLORS.textDim,
                            letterSpacing: 2,
                        }}
                    >
                        HELLDIVERS 1
                    </span>
                    <span
                        style={{
                            fontSize: 34,
                            color: COLORS.yellow,
                            fontWeight: 'bold',
                        }}
                    >
                        GALACTIC WAR
                    </span>
                </div>
                <img
                    src={mapDataUri}
                    width={600}
                    height={600}
                    style={{ objectFit: 'contain' }}
                />
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '40%',
                    height: '100%',
                    padding: '40px 32px',
                    justifyContent: 'center',
                    gap: 16,
                }}
            >
                <span
                    style={{
                        fontSize: 24,
                        color: COLORS.yellow,
                        fontWeight: 'bold',
                        letterSpacing: 3,
                    }}
                >
                    SEASON {data.season ?? '?'}
                </span>
                <span
                    style={{
                        fontSize: 44,
                        color: statusColor,
                        fontWeight: 'bold',
                    }}
                >
                    {statusText}
                </span>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 20,
                        marginTop: 16,
                    }}
                >
                    {factionStats.map((f) => (
                        <div
                            key={f.enemy}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: 20,
                                    fontWeight: 'bold',
                                    color: f.textColor,
                                }}
                            >
                                <span>{f.name}</span>
                                <span>{f.percent}%</span>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    height: 14,
                                    background: COLORS.barBg,
                                    borderRadius: 5,
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        width: `${f.percent}%`,
                                        height: '100%',
                                        background: f.barColor,
                                        borderRadius: 5,
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <span
                    style={{
                        fontSize: 16,
                        color: COLORS.textMuted,
                        marginTop: 'auto',
                    }}
                >
                    helldivers.bot
                </span>
            </div>
        </div>,
        { width: 1200, height: 630, headers: CACHE_HEADERS },
    );
}
