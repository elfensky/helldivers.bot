'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTrack } from '@/shared/hooks/useTrack';
import { useMermaidRender } from './useMermaidRender';
import DetailPanel from './DetailPanel';
import './MermaidDiagram.css';

/**
 * Extract the original node ID from Mermaid's rendered SVG element.
 * Mermaid v11 assigns IDs like "mermaid-data-flow-1-flowchart-api_status-0".
 * We extract the node ID between "flowchart-" and the trailing "-N" suffix.
 */
function extractNodeId(nodeElement) {
    const rawId = nodeElement.id || '';
    // Match "flowchart-{nodeId}-{index}" anywhere in the ID
    const match = rawId.match(/flowchart-(.+)-\d+$/);
    if (match) return match[1];
    // Fallback: try data-id attribute
    return nodeElement.getAttribute('data-id') || rawId;
}

/**
 * Extract source and target node IDs from a Mermaid edge's data-id attribute.
 * Format: "L_{source}_{target}_{index}" — e.g., "L_api_status_worker_0"
 *
 * Since node IDs can contain underscores, we match against known node IDs
 * to find the correct split point.
 */
function parseEdgeEndpoints(dataId, knownNodeIds) {
    if (!dataId || !dataId.startsWith('L_')) return null;
    const body = dataId.slice(2); // strip "L_"
    // Try each known node as the source prefix
    for (const src of knownNodeIds) {
        if (!body.startsWith(src + '_')) continue;
        const rest = body.slice(src.length + 1); // strip "{source}_"
        // Try each known node as the target
        for (const tgt of knownNodeIds) {
            if (rest === tgt + '_0' || rest.startsWith(tgt + '_')) {
                return { source: src, target: tgt };
            }
        }
    }
    return null;
}

/**
 * Apply dim/highlight classes to SVG nodes and edges based on active flow filter.
 * Mermaid v11 DOM structure:
 *   - Nodes: g.node (each with a unique ID containing the node key)
 *   - Edges: path.flowchart-link with data-id="L_{source}_{target}_{index}"
 *   - Edge labels: g.edgeLabel elements
 *   - Subgraphs: g.cluster elements (never dimmed — opacity cascades to children)
 */
function applyFlowFilter(container, activeView, flows) {
    const allNodes = container.querySelectorAll('.node');
    const allEdgeLabels = container.querySelectorAll('.edgeLabel');
    const allEdgePaths = container.querySelectorAll('.flowchart-link');

    if (activeView === 'all') {
        [...allNodes, ...allEdgeLabels, ...allEdgePaths].forEach((el) => {
            el.classList.remove('diagram-dimmed', 'diagram-highlighted');
        });
        return;
    }

    const activeNodeIds = new Set(flows[activeView] || []);

    // Build set of all known node IDs for edge parsing
    const allNodeIds = [];
    allNodes.forEach((node) => allNodeIds.push(extractNodeId(node)));

    // Highlight/dim nodes
    allNodes.forEach((node) => {
        const nodeId = extractNodeId(node);
        if (activeNodeIds.has(nodeId)) {
            node.classList.remove('diagram-dimmed');
            node.classList.add('diagram-highlighted');
        } else {
            node.classList.remove('diagram-highlighted');
            node.classList.add('diagram-dimmed');
        }
    });

    // Mermaid v11 renders multiple .edgeLabel elements per edge (background + text).
    // Compute stride to map each edge path to its corresponding label group.
    const labelsPerEdge =
        allEdgePaths.length > 0 ? Math.round(allEdgeLabels.length / allEdgePaths.length) : 1;

    // Highlight edges + their labels
    allEdgePaths.forEach((edge, i) => {
        const dataId = edge.getAttribute('data-id');
        const endpoints = parseEdgeEndpoints(dataId, allNodeIds);
        const isActive =
            endpoints && activeNodeIds.has(endpoints.source) && activeNodeIds.has(endpoints.target);

        const applyClass = (el, active) => {
            if (!el) return;
            el.classList.remove(active ? 'diagram-dimmed' : 'diagram-highlighted');
            el.classList.add(active ? 'diagram-highlighted' : 'diagram-dimmed');
        };

        applyClass(edge, isActive);
        for (let j = 0; j < labelsPerEdge; j++) {
            applyClass(allEdgeLabels[i * labelsPerEdge + j], isActive);
        }
    });
}

/**
 * Safely inject SVG content into a container element.
 *
 * SECURITY NOTE: All diagram definitions are static strings in source code,
 * never user-supplied. Mermaid's securityLevel: 'strict' prevents script
 * injection in definitions. This is safe in this controlled context.
 */
function injectSvg(container, svgContent) {
    // Clear previous content
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    // Parse SVG and append as DOM nodes (avoids innerHTML string assignment)
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svgElement = doc.documentElement;
    if (svgElement && svgElement.tagName === 'svg') {
        container.appendChild(container.ownerDocument.importNode(svgElement, true));
    }
}

/**
 * Reusable Mermaid diagram component with flow filtering and detail panels.
 *
 * @param {object} props
 * @param {string} props.id - Unique diagram ID
 * @param {string} props.definition - Mermaid syntax string
 * @param {object} props.config - Diagram configuration (views, flows, details, legend)
 * @param {string} [props.mobileDefinition] - Optional Mermaid definition for mobile (e.g., TD layout)
 * @param {string} [props.className]
 */
export default function MermaidDiagram({
    id,
    definition,
    mobileDefinition,
    config,
    className,
}) {
    const [activeView, setActiveView] = useState('all');
    const [selectedNode, setSelectedNode] = useState(null);
    const containerRef = useRef(null);
    const track = useTrack();

    // Pick definition based on viewport width (mobile = vertical, desktop = horizontal)
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        if (!mobileDefinition) return;
        const mql = window.matchMedia('(max-width: 768px)');
        setIsMobile(mql.matches);
        const handler = (e) => setIsMobile(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [mobileDefinition]);

    const activeDefinition = mobileDefinition && isMobile ? mobileDefinition : definition;
    const svgHtml = useMermaidRender(id, activeDefinition);

    // Track whether SVG has been injected into the DOM
    const svgInjectedRef = useRef('');

    // Post-render: inject SVG and set up accessibility on nodes (only when SVG changes)
    useEffect(() => {
        if (!containerRef.current || !svgHtml) return;
        // Only re-inject if the SVG content actually changed
        if (svgInjectedRef.current === svgHtml) return;
        svgInjectedRef.current = svgHtml;

        injectSvg(containerRef.current, svgHtml);
        // Set up accessibility on nodes that have details
        const nodes = containerRef.current.querySelectorAll('.node');
        nodes.forEach((node) => {
            const nodeId = extractNodeId(node);
            if (config.details[nodeId]) {
                node.setAttribute('tabindex', '0');
                node.setAttribute('role', 'button');
                const labelEl = node.querySelector('.nodeLabel');
                if (labelEl) {
                    node.setAttribute('aria-label', labelEl.textContent.trim());
                }
                node.style.cursor = 'pointer';
            }
        });
        // Apply current filter after injection
        applyFlowFilter(containerRef.current, activeView, config.flows);
    }, [svgHtml, config.details, activeView, config.flows]);

    // Apply dim/highlight when only the view changes (SVG already in DOM)
    useEffect(() => {
        if (!containerRef.current || !svgInjectedRef.current) return;
        applyFlowFilter(containerRef.current, activeView, config.flows);
    }, [activeView, config.flows]);

    // Click handler (event delegation)
    const handleClick = useCallback(
        (e) => {
            const nodeEl = e.target.closest('.node');
            if (!nodeEl) return;
            const nodeId = extractNodeId(nodeEl);
            if (config.details[nodeId]) {
                setSelectedNode(nodeId);
                track('diagram-node-click', { diagram: id, node: nodeId });
            }
        },
        [config.details, id, track],
    );

    // Keyboard handler (event delegation)
    const handleKeyDown = useCallback(
        (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const nodeEl = e.target.closest('.node');
            if (!nodeEl) return;
            e.preventDefault();
            const nodeId = extractNodeId(nodeEl);
            if (config.details[nodeId]) {
                setSelectedNode(nodeId);
                track('diagram-node-click', { diagram: id, node: nodeId });
            }
        },
        [config.details, id, track],
    );

    // Escape to close detail panel
    useEffect(() => {
        if (!selectedNode) return;
        const handler = (e) => {
            if (e.key === 'Escape') setSelectedNode(null);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [selectedNode]);

    return (
        <div className={`diagram-wrapper ${className || ''}`}>
            {/* Filter controls (hidden for single-flow diagrams) */}
            {config.views.length > 1 && (
                <div className="diagram-controls">
                    {config.views.map((view) => (
                        <button
                            key={view.key}
                            className={activeView === view.key ? 'active' : ''}
                            data-umami-event={`diagram-${id}-${view.key}`}
                            onClick={() => setActiveView(view.key)}
                        >
                            {view.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Mermaid SVG */}
            <div
                ref={containerRef}
                className="diagram-canvas"
                role="img"
                aria-label={config.description}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
            />

            {/* Legend */}
            <div className="diagram-legend">
                {config.legend.map((item) => (
                    <div key={item.label} className="diagram-legend-item">
                        <div
                            className="diagram-legend-dot"
                            style={{ background: item.color }}
                        />
                        <span>{item.label}</span>
                    </div>
                ))}
                <div
                    className="diagram-legend-item"
                    style={{ color: 'var(--color-text-muted)', fontSize: 10 }}
                >
                    Click any node for details
                </div>
            </div>

            {/* Detail panel */}
            <DetailPanel
                data={selectedNode ? config.details[selectedNode] : null}
                onClose={() => setSelectedNode(null)}
            />
        </div>
    );
}
