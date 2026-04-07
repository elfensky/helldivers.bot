import { useState, useEffect, useRef } from 'react';
import { ensureMermaidInit } from './initMermaid';

/**
 * Renders a Mermaid definition to an SVG string.
 * Client-side only — returns empty string during SSR.
 *
 * Uses a unique render ID per effect run to avoid conflicts when
 * React strict mode double-fires effects with the same base ID.
 *
 * @param {string} id - Base ID for this diagram
 * @param {string} definition - Mermaid syntax string
 * @returns {string} SVG HTML string
 */
export function useMermaidRender(id, definition) {
    const [svgHtml, setSvgHtml] = useState('');
    const renderCount = useRef(0);

    useEffect(() => {
        let cancelled = false;
        // Unique ID per render to avoid Mermaid cache conflicts in React strict mode
        const renderId = `mermaid-${id}-${++renderCount.current}`;

        (async () => {
            try {
                await ensureMermaidInit();
                const mermaid = (await import('mermaid')).default;
                const { svg } = await mermaid.render(renderId, definition);
                if (!cancelled) setSvgHtml(svg);
            } catch (err) {
                console.error('[MermaidDiagram] render failed:', err);
            }
        })();

        return () => {
            cancelled = true;
            // Clean up Mermaid's temp element if it exists
            const tempEl = document.getElementById('d' + renderId);
            if (tempEl) tempEl.remove();
        };
    }, [id, definition]);

    return svgHtml;
}
