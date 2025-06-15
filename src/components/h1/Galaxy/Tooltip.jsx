import './Tooltip.css';
import { useRef, useState, useEffect } from 'react';
import factions from '@/enums/factions';

export default function Tooltip({ svgRef, map }) {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [hover, setHover] = useState(null); //{ faction: "0", id: "1" }
    useEffect(() => {
        //#region Mouse Move
        const handleMouseMove = (event) => {
            setMousePos({ x: event.clientX, y: event.clientY });

            // Get the element under the mouse
            const el = document.elementFromPoint(event.clientX, event.clientY);

            // Check if it's a sector/path/circle in your SVG
            if (el && svgRef.current && svgRef.current.contains(el)) {
                const data = el.id.split('-');
                if (data.length !== 2) {
                    setHover(null);
                } else {
                    const hoverData = {
                        faction: data[0],
                        id: data[1],
                    };
                    setHover(hoverData);
                }
            } else {
                setHover(null);
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
        //#endregion
    }, []);

    if (!hover) return null;
    if (hover.faction === '3')
        return (
            <div
                id="tooltip"
                role="tooltip"
                className={
                    'pointer-events-none absolute z-50 flex flex-col items-start justify-center gap-1 bg-purple-500 p-2'
                }
                style={{ left: mousePos.x + 5, top: mousePos.y - 55 }}
            >
                <div className="flex items-center gap-2">
                    <img
                        src={`/icons/faction${hover?.faction}.webp`}
                        alt="Logo of Helldivers Bot, which is a cartoon depiction of a spy sattelite"
                        width={20}
                        height={20}
                    />
                    <span>{map[hover?.faction][hover?.id].region}</span>
                </div>
            </div>
        );

    return (
        <div
            id="tooltip"
            role="tooltip"
            className={
                'pointer-events-none absolute z-50 flex flex-col items-start justify-center gap-1 bg-purple-500 p-2'
            }
            style={{ left: mousePos.x + 5, top: mousePos.y - 55 }}
        >
            <p className="flex items-center gap-2">
                <img
                    src={`/icons/faction${hover?.faction}.webp`}
                    alt="Logo of Helldivers Bot, which is a cartoon depiction of a spy sattelite"
                    width={20}
                    height={20}
                />
                <span>{map[hover?.faction][hover?.id].region}</span>
            </p>
            <div className="relative">
                <progress
                    value={map[hover?.faction][hover?.id].percent}
                    max="100"
                ></progress>
                <span className="absolute right-0">
                    {map[hover?.faction][hover?.id].percent.toFixed(2)}%
                </span>
            </div>

            <p>
                {map[hover?.faction][hover?.id].points}/
                {map[hover?.faction][hover?.id].points_max} points
            </p>
            {/* <span>
                {map[hover?.faction][hover?.id].points_sector}/
                {map[hover?.faction][hover?.id].points_sector_max} points
            </span> */}
        </div>
    );
}
