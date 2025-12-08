import './Tooltip.css';
import { useRef, useState, useEffect } from 'react';
import factions from '@/enums/factions';

export default function Tooltip({ svgRef, map }) {
    const [hover, setHover] = useState(null); //{ faction: "0", id: "1" }
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });
    const [tooltipSize, setTooltipSize] = useState({ width: 320, height: 103 })



    useEffect(() => {
        //get viewPortSize
        function handleResize() {
            setViewportSize({ width: window.innerWidth, height: window.innerHeight });
        };
        handleResize();
        window.addEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        //#region Mouse Move
        const handleMouseMove = (event) => {
            // const mousePos = { x: event.clientX, y: event.clientY };
            const newMouseX = event.clientX;
            const newMouseY = event.clientY;
            setMousePos({ x: newMouseX, y: newMouseY });

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

            // Calculate maximum allowable x and y for the tooltip to stay within bounds
            const maxTooltipX = viewportSize.width - tooltipSize.width;
            const maxTooltipY = viewportSize.height - tooltipSize.height;

            // Calculate the desired tooltip position (e.g., offset slightly from mouse)
            // You might want to adjust these offsets based on your design
            const desiredTooltipX = newMouseX + 5; // Example offset
            const desiredTooltipY = newMouseY + 55; // Example offset

            // Constrain the tooltip position
            const constrainedX = Math.min(Math.max(0, desiredTooltipX), maxTooltipX);
            const constrainedY = Math.min(Math.max(0, desiredTooltipY), maxTooltipY);

            setTooltipPos({ x: constrainedX, y: constrainedY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
        //#endregion
    }, [viewportSize])

    if (!hover) return null;
    if (hover.faction === '3')
        return (
            <div
                id="tooltip"
                role="tooltip"
                className={
                    'pointer-events-none absolute z-50 flex flex-col items-start justify-center gap-1 bg-purple-500 p-2'
                }
                style={{ left: tooltipPos.x, top: tooltipPos.y - 55 }}
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
            style={{ left: tooltipPos.x + 5, top: tooltipPos.y - 55 }}
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
