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
 * Apply dim/highlight classes to SVG nodes and edges based on active flow filter.
 * Mermaid v11 DOM structure:
 *   - Nodes: g.node (each with a unique ID containing the node key)
 *   - Edges: g.edgePaths contains path.flowchart-link elements (no per-edge groups)
 *   - Edge labels: g.edgeLabel elements
 *   - Subgraphs: g.cluster elements
 */
function applyFlowFilter(container, activeView, flows) {
    const allNodes = container.querySelectorAll('.node');
    const allEdgeLabels = container.querySelectorAll('.edgeLabel');
    const allClusters = container.querySelectorAll('.cluster');
    // Individual edge paths (Mermaid v11 uses .flowchart-link on each path)
    const allEdgePaths = container.querySelectorAll('.flowchart-link');

    const allElements = [...allNodes, ...allEdgeLabels, ...allClusters, ...allEdgePaths];

    if (activeView === 'all') {
        allElements.forEach((el) => {
            el.classList.remove('diagram-dimmed', 'diagram-highlighted');
        });
        return;
    }

    const activeNodeIds = new Set(flows[activeView] || []);

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

    // Dim all edges and labels, then selectively highlight
    [...allEdgePaths, ...allEdgeLabels].forEach((el) => {
        el.classList.remove('diagram-highlighted');
        el.classList.add('diagram-dimmed');
    });

    // Dim subgraph clusters too
    allClusters.forEach((el) => {
        el.classList.remove('diagram-highlighted');
        el.classList.add('diagram-dimmed');
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
 * @param {string} [props.className]
 */
export default function MermaidDiagram({ id, definition, config, className }) {
    const [activeView, setActiveView] = useState('all');
    const [selectedNode, setSelectedNode] = useState(null);
    const containerRef = useRef(null);
    const track = useTrack();
    const svgHtml = useMermaidRender(id, definition);

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
            {/* Filter controls */}
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
