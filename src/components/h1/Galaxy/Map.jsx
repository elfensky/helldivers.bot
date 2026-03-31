import './Map.css';
import {
    viewBox,
    bugPaths,
    cyborgPaths,
    illuminatePaths,
    superEarthCircle,
    factionIcons,
} from '@/enums/mapPaths.mjs';

const factions = [
    { id: 'bugs', index: 0, paths: bugPaths },
    { id: 'cyborgs', index: 1, paths: cyborgPaths },
    { id: 'illuminate', index: 2, paths: illuminatePaths },
];

export default function Map({ svgRef, map }) {
    const superearth = 3;

    return (
        <div id="map" className="max-h-full w-full">
            <svg
                ref={svgRef}
                id="Layer_2"
                data-name="Layer 2"
                xmlns="http://www.w3.org/2000/svg"
                viewBox={viewBox}
                preserveAspectRatio="xMaxYMid meet"
                className="w-full h-full"
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
