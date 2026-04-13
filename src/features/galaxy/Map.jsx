import './Map.css';
import {
    viewBox,
    bugPaths,
    cyborgPaths,
    illuminatePaths,
    superEarthCircle,
    factionIcons,
} from '@/features/galaxy/mapPaths.mjs';

/**
 * Renders the galaxy map SVG. The root `<svg>` uses
 * `preserveAspectRatio="xMaxYMid meet"` — content scales to fit the
 * box while aligning to the right edge and vertically centered.
 * This choice matters in two places:
 *
 *   - **Desktop (lg+)**: the grid column's width is sized from
 *     viewport height via `minmax(0, calc((100dvh - 80px) * 806.93 /
 *     868.81))`, so the SVG box matches the content's aspect ratio
 *     exactly and `xMax` is a no-op — content fills the cell.
 *
 *   - **Mobile/tablet when pinned**: `.home-map--sticky` /
 *     `.archives-map-col--sticky` caps the SVG's `max-height: 55dvh`
 *     and `max-width: calc(55dvh * 806.93 / 868.81)` so the box
 *     matches the intrinsic aspect ratio. Again `xMax` alignment is
 *     a no-op because there's no leftover horizontal space inside
 *     the SVG. `margin-inline: auto` on the SVG then centers the
 *     whole shrunk box inside the full-bleed sticky panel.
 *
 * The `#map` wrapper div provides a flex-column sizing context so
 * the SVG's `flex-1` + `min-h-0` resolves correctly when the parent
 * has an explicit max-height. Any other SVG rendered elsewhere in
 * the map column (e.g. icon SVGs in the archive's detail card)
 * isn't affected because the CSS selectors are scoped to
 * `#map > svg`.
 */

const factions = [
    { id: 'bugs', index: 0, paths: bugPaths },
    { id: 'cyborgs', index: 1, paths: cyborgPaths },
    { id: 'illuminate', index: 2, paths: illuminatePaths },
];

function pulseStyle(delays, key) {
    const delay = delays?.get(key);
    return delay != null ? { '--pulse-delay': `${delay}s` } : undefined;
}

export default function Map({ map, pulseDelays }) {
    const superearth = 3;

    return (
        <div id="map" className="flex min-h-0 w-full flex-1 flex-col">
            <svg
                id="Layer_2"
                data-name="Layer 2"
                xmlns="http://www.w3.org/2000/svg"
                viewBox={viewBox}
                preserveAspectRatio="xMaxYMid meet"
                className="min-h-0 w-full min-w-0 flex-1"
            >
                <defs>
                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow
                            dx="5"
                            dy="5"
                            stdDeviation="2"
                            floodColor="rgba(255,255,0, 1.0)"
                        />
                    </filter>
                    <filter id="glow">
                        <feGaussianBlur
                            className="blur"
                            result="coloredBlur"
                            stdDeviation="4"
                        ></feGaussianBlur>
                        <feMerge>
                            <feMergeNode in="coloredBlur"></feMergeNode>
                            <feMergeNode in="coloredBlur"></feMergeNode>
                            <feMergeNode in="coloredBlur"></feMergeNode>
                            <feMergeNode in="SourceGraphic"></feMergeNode>
                        </feMerge>
                    </filter>
                    <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur
                            in="SourceGraphic"
                            result="blur"
                            stdDeviation="6"
                        />
                        <feFlood floodColor="rgba(255,0,0,0.6)" result="color" />
                        <feComposite
                            in="color"
                            in2="blur"
                            operator="in"
                            result="redGlow"
                        />
                        <feMerge>
                            <feMergeNode in="redGlow" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                {factions.map(({ id, index, paths }) => (
                    <g key={id} id={id}>
                        {paths.map((path) => (
                            <path
                                key={path.id}
                                id={path.id}
                                data-name={String(path.sector)}
                                data-faction={id}
                                className={
                                    path.sector === 11 ?
                                        'sector ' + map[index][11].status
                                    :   'sector ' +
                                        map[index][path.sector].status +
                                        ' ' +
                                        map[index][path.sector].event
                                }
                                style={pulseStyle(pulseDelays, `${index}-${path.sector}`)}
                                d={path.d}
                            />
                        ))}
                        <image
                            href={factionIcons[index].href}
                            className="pointer-events-none"
                            x={factionIcons[index].x}
                            y={factionIcons[index].y}
                            width={factionIcons[index].width}
                            height={factionIcons[index].height}
                        />
                    </g>
                ))}
                <g id="superearth">
                    <circle
                        id={superEarthCircle.id}
                        data-name="0"
                        className={
                            'sector ' +
                            map[superearth][0].status +
                            ' ' +
                            map[superearth][0].event
                        }
                        style={pulseStyle(pulseDelays, `${superearth}-0`)}
                        cx={superEarthCircle.cx}
                        cy={superEarthCircle.cy}
                        r={superEarthCircle.r}
                    />
                    <image
                        className="pointer-events-none"
                        href={factionIcons[3].href}
                        x={factionIcons[3].x}
                        y={factionIcons[3].y}
                        width={factionIcons[3].width}
                        height={factionIcons[3].height}
                    />
                </g>
            </svg>
        </div>
    );
}
