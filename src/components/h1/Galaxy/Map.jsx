import './Map.css';
import {
    viewBox,
    bugPaths,
    cyborgPaths,
    illuminatePaths,
    superEarthCircle,
    factionIcons,
} from '@/enums/mapPaths.mjs';

export default function Map({ svgRef, map }) {
    const bugs = 0;
    const cyborgs = 1;
    const illuminate = 2;
    const superearth = 3;
    // console.log(map[illuminate][10])
    // console.log(map[superearth])
    return (
        <>
            <div id="map" className="max-h-full w-full">
                {/* right-0 z-40 mt-8 aspect-square max-h-[80vh] w-full */}
                <svg
                    ref={svgRef}
                    id="Layer_2"
                    data-name="Layer 2"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox={viewBox}
                    className="max-h-[85vh]"
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
                    <g id="bugs">
                        {bugPaths.map((path) => (
                            <path
                                key={path.id}
                                id={path.id}
                                data-name={String(path.sector)}
                                data-faction="bugs"
                                className={
                                    path.sector === 11 ?
                                        'sector ' + map[bugs][11].status
                                    :   'sector ' +
                                        map[bugs][path.sector].status +
                                        ' ' +
                                        map[bugs][path.sector].event
                                }
                                d={path.d}
                            />
                        ))}
                        <image
                            href={factionIcons[0].href}
                            className="pointer-events-none"
                            x={factionIcons[0].x}
                            y={factionIcons[0].y}
                            width={factionIcons[0].width}
                            height={factionIcons[0].height}
                        />
                    </g>
                    <g id="cyborgs">
                        {cyborgPaths.map((path) => (
                            <path
                                key={path.id}
                                id={path.id}
                                data-name={String(path.sector)}
                                data-faction="cyborgs"
                                className={
                                    path.sector === 11 ?
                                        'sector ' + map[cyborgs][11].status
                                    :   'sector ' +
                                        map[cyborgs][path.sector].status +
                                        ' ' +
                                        map[cyborgs][path.sector].event
                                }
                                d={path.d}
                            />
                        ))}
                        <image
                            href={factionIcons[1].href}
                            className="pointer-events-none"
                            x={factionIcons[1].x}
                            y={factionIcons[1].y}
                            width={factionIcons[1].width}
                            height={factionIcons[1].height}
                        />
                    </g>
                    <g id="illuminate">
                        {illuminatePaths.map((path) => (
                            <path
                                key={path.id}
                                id={path.id}
                                data-name={String(path.sector)}
                                data-faction="illuminate"
                                className={
                                    path.sector === 11 ?
                                        'sector ' + map[illuminate][11].status
                                    :   'sector ' +
                                        map[illuminate][path.sector].status +
                                        ' ' +
                                        map[illuminate][path.sector].event
                                }
                                d={path.d}
                            />
                        ))}
                        <image
                            href={factionIcons[2].href}
                            className="pointer-events-none"
                            x={factionIcons[2].x}
                            y={factionIcons[2].y}
                            width={factionIcons[2].width}
                            height={factionIcons[2].height}
                        />
                    </g>
                    <g id="superearth">
                        <circle
                            id={superEarthCircle.id}
                            data-name="0"
                            className={'sector captured ' + map[superearth][0].status}
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
        </>
    );
}
