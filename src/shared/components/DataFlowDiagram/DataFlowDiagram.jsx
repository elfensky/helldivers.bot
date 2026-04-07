'use client';

import { useState, useCallback, useEffect } from 'react';
import { detailData } from './detailData';
import './DataFlowDiagram.css';

const VIEWS = [
    { key: 'all', label: 'All Flows' },
    { key: 'live', label: 'Live Polling (5-15s)' },
    { key: 'snapshot', label: 'Snapshot Sync' },
    { key: 'seed', label: 'Seed (Bootstrap)' },
    { key: 'refresh', label: 'Force Refresh' },
    { key: 'read', label: 'Frontend Reads' },
];

const FLOW_MAP = {
    live: ['live'],
    snapshot: ['snapshot'],
    seed: ['seed'],
    refresh: ['refresh'],
    read: ['read-map', 'read-stats', 'read-events'],
};

const LEGEND = [
    { color: '#3b82f6', label: 'Official API' },
    { color: '#a855f7', label: 'Worker / Processing' },
    { color: '#f59e0b', label: 'Raw Cache (rebroadcast)' },
    { color: '#22c55e', label: 'Normalized (h1_*)' },
    { color: '#ec4899', label: 'Seed Files (past wars)' },
    { color: '#06b6d4', label: 'Frontend Components' },
];

function getVisibilityClass(elementFlows, activeView) {
    if (activeView === 'all') return '';
    const activeFlows = FLOW_MAP[activeView] || [activeView];
    const flows = elementFlows.split(' ');
    const matches = flows.some((f) => activeFlows.includes(f));
    return matches ? 'diagram-highlighted' : 'diagram-dimmed';
}

function DetailSection({ section }) {
    if (section.type === 'text') {
        return <p>{section.content}</p>;
    }
    if (section.type === 'heading') {
        return <h4 className="diagram-detail-heading">{section.content}</h4>;
    }
    if (section.type === 'code') {
        return <pre>{section.content}</pre>;
    }
    if (section.type === 'tags') {
        return (
            <div>
                {section.items.map((tag) => (
                    <span key={tag.text} className={`diagram-tag ${tag.cls}`}>
                        {tag.text}
                    </span>
                ))}
            </div>
        );
    }
    if (section.type === 'table') {
        return (
            <table className="diagram-schema-table">
                <thead>
                    <tr>
                        {section.headers.map((h) => (
                            <th key={h}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {section.rows.map((row, i) => (
                        <tr key={i}>
                            {row.map((cell, j) => (
                                <td key={j}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }
    return null;
}

function DetailPanel({ nodeId, onClose }) {
    const data = nodeId ? detailData[nodeId] : null;
    const isOpen = Boolean(data);

    return (
        <>
            <div
                className={`diagram-detail-overlay ${isOpen ? 'open' : ''}`}
                onClick={onClose}
            />
            <div className={`diagram-detail-panel ${isOpen ? 'open' : ''}`}>
                <button
                    className="diagram-detail-close"
                    onClick={onClose}
                    aria-label="Close detail panel"
                >
                    &times;
                </button>
                {data && (
                    <>
                        <h3>{data.title}</h3>
                        <div className="diagram-detail-subtitle">{data.subtitle}</div>
                        {data.sections.map((section, i) => (
                            <DetailSection key={i} section={section} />
                        ))}
                    </>
                )}
            </div>
        </>
    );
}

function DiagramNode({
    x,
    y,
    w,
    h,
    id,
    flows,
    category,
    label,
    sublabel,
    sublabel2,
    sublabel3,
    activeView,
    onSelect,
}) {
    const vis = getVisibilityClass(flows, activeView);
    return (
        <g
            className={`diagram-node ${category} ${vis}`}
            tabIndex={0}
            role="button"
            aria-label={label}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(id);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(id);
                }
            }}
        >
            <rect x={x} y={y} width={w} height={h} rx={0} ry={0} />
            <text
                className="label"
                x={x + w / 2}
                y={y + 22}
                textAnchor="middle"
                fontSize={13}
                fontWeight={600}
            >
                {label}
            </text>
            {sublabel && (
                <text
                    x={x + w / 2}
                    y={y + 40}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#666"
                >
                    {sublabel}
                </text>
            )}
            {sublabel2 && (
                <text
                    x={x + w / 2}
                    y={y + 58}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#666"
                >
                    {sublabel2}
                </text>
            )}
            {sublabel3 && (
                <text
                    x={x + w / 2}
                    y={y + 74}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#555"
                >
                    {sublabel3}
                </text>
            )}
        </g>
    );
}

function DiagramArrow({ d, flows, arrowClass, markerEnd, activeView, dashed }) {
    const vis = getVisibilityClass(flows, activeView);
    return (
        <path
            className={`diagram-arrow ${arrowClass} ${dashed ? 'arrow-dashed' : ''} ${vis}`}
            d={d}
            markerEnd={markerEnd}
        />
    );
}

function Annotation({ x, y, bgW, text, flows, activeView }) {
    const vis = getVisibilityClass(flows, activeView);
    return (
        <g className={vis}>
            <rect
                className="diagram-annotation-bg"
                x={x - bgW / 2}
                y={y - 11}
                width={bgW}
                height={16}
            />
            <text className="diagram-annotation" x={x} y={y} textAnchor="middle">
                {text}
            </text>
        </g>
    );
}

export default function DataFlowDiagram() {
    const [activeView, setActiveView] = useState('all');
    const [selectedNode, setSelectedNode] = useState(null);

    const handleNodeSelect = useCallback((id) => {
        setSelectedNode(id);
    }, []);

    const handleCloseDetail = useCallback(() => {
        setSelectedNode(null);
    }, []);

    useEffect(() => {
        if (!selectedNode) return;
        const handler = (e) => {
            if (e.key === 'Escape') handleCloseDetail();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [selectedNode, handleCloseDetail]);

    return (
        <div className="diagram-wrapper">
            {/* Filter controls */}
            <div className="diagram-controls">
                {VIEWS.map((view) => (
                    <button
                        key={view.key}
                        className={activeView === view.key ? 'active' : ''}
                        data-umami-event={`diagram-dataflow-${view.key}`}
                        onClick={() => setActiveView(view.key)}
                    >
                        {view.label}
                    </button>
                ))}
            </div>

            {/* SVG diagram */}
            <div className="diagram-canvas">
                <svg
                    className="diagram-flow"
                    viewBox="0 0 1100 560"
                    role="img"
                    aria-label="Data flow architecture diagram showing how data moves from the official Helldivers API through processing, validation, database storage, and frontend display"
                >
                    <title>Helldivers Bot Data Flow Architecture</title>
                    <desc>
                        Interactive diagram showing 4 data sources (live API, snapshots,
                        seed files, force refresh) flowing through worker threads and
                        validation into raw cache and normalized database tables, then
                        consumed by frontend components.
                    </desc>

                    {/* Arrow markers */}
                    <defs>
                        {[
                            { id: 'ah-blue', fill: '#3b82f6' },
                            { id: 'ah-amber', fill: '#f59e0b' },
                            { id: 'ah-green', fill: '#22c55e' },
                            { id: 'ah-pink', fill: '#ec4899' },
                            { id: 'ah-cyan', fill: '#06b6d4' },
                        ].map((m) => (
                            <marker
                                key={m.id}
                                id={m.id}
                                markerWidth={8}
                                markerHeight={6}
                                refX={8}
                                refY={3}
                                orient="auto"
                            >
                                <polygon points="0 0, 8 3, 0 6" fill={m.fill} />
                            </marker>
                        ))}
                    </defs>

                    {/* Layer labels */}
                    <text
                        className="diagram-layer-label"
                        x={120}
                        y={24}
                        textAnchor="middle"
                    >
                        DATA SOURCES
                    </text>
                    <text
                        className="diagram-layer-label"
                        x={430}
                        y={24}
                        textAnchor="middle"
                    >
                        PROCESSING
                    </text>
                    <text
                        className="diagram-layer-label"
                        x={720}
                        y={20}
                        textAnchor="middle"
                    >
                        DATABASE
                    </text>
                    <text
                        className="diagram-layer-label"
                        x={1000}
                        y={200}
                        textAnchor="middle"
                    >
                        FRONTEND
                    </text>
                    <text
                        className="diagram-sublabel"
                        x={615}
                        y={44}
                        textAnchor="end"
                        fill="rgba(245,158,11,0.25)"
                    >
                        RAW
                    </text>
                    <text
                        className="diagram-sublabel"
                        x={615}
                        y={186}
                        textAnchor="end"
                        fill="rgba(34,197,94,0.25)"
                    >
                        NORMALIZED
                    </text>

                    {/* LAYER 1: DATA SOURCES */}
                    <DiagramNode
                        x={20}
                        y={40}
                        w={200}
                        h={56}
                        id="api-status"
                        flows="live"
                        category="cat-api"
                        label="get_campaign_status"
                        sublabel="Live war state + stats"
                        activeView={activeView}
                        onSelect={handleNodeSelect}
                    />
                    <DiagramNode
                        x={20}
                        y={130}
                        w={200}
                        h={56}
                        id="api-snapshot"
                        flows="snapshot"
                        category="cat-api"
                        label="get_snapshots"
                        sublabel="Historical time-series"
                        activeView={activeView}
                        onSelect={handleNodeSelect}
                    />
                    <DiagramNode
                        x={20}
                        y={260}
                        w={200}
                        h={56}
                        id="seed-files"
                        flows="seed"
                        category="cat-seed"
                        label="prisma/seed/seasons/*.json"
                        sublabel="Bootstrap (first deploy)"
                        activeView={activeView}
                        onSelect={handleNodeSelect}
                    />
                    <DiagramNode
                        x={20}
                        y={350}
                        w={200}
                        h={56}
                        id="api-refresh"
                        flows="refresh"
                        category="cat-api"
                        label="get_snapshots (forced)"
                        sublabel="Re-fetch any season"
                        activeView={activeView}
                        onSelect={handleNodeSelect}
                    />

                    {/* LAYER 2: PROCESSING */}
                    <DiagramNode
                        x={340}
                        y={40}
                        w={180}
                        h={86}
                        id="worker"
                        flows="live snapshot"
                        category="cat-worker"
                        label="Worker Thread"
                        sublabel="cron.js"
                        sublabel2="setTimeout loop"
                        sublabel3="poll > validate > upsert"
                        activeView={activeView}
                        onSelect={handleNodeSelect}
                    />
                    <DiagramNode
                        x={340}
                        y={260}
                        w={180}
                        h={56}
                        id="seed-script"
                        flows="seed"
                        category="cat-seed"
                        label="Seed Script"
                        sublabel="prisma db seed / startup"
                        activeView={activeView}
                        onSelect={handleNodeSelect}
                    />
                    <DiagramNode
                        x={340}
                        y={350}
                        w={180}
                        h={56}
                        id="refresh-handler"
                        flows="refresh"
                        category="cat-api"
                        label="updateSeason()"
                        sublabel="fetch + validate + upsert"
                        activeView={activeView}
                        onSelect={handleNodeSelect}
                    />

                    {/* LAYER 3: RAW CACHE */}
                    <DiagramNode
                        x={620}
                        y={30}
                        w={200}
                        h={48}
                        id="rb-status"
                        flows="live"
                        category="cat-raw"
                        label="rebroadcast_status"
                        sublabel="1 row/season - raw JSON"
                        activeView={activeView}
                        onSelect={handleNodeSelect}
                    />
                    <DiagramNode
                        x={620}
                        y={90}
                        w={200}
                        h={48}
                        id="rb-snapshot"
                        flows="snapshot refresh"
                        category="cat-raw"
                        label="rebroadcast_snapshot"
                        sublabel="1 row/season - raw JSON"
                        activeView={activeView}
                        onSelect={handleNodeSelect}
                    />

                    {/* LAYER 4: NORMALIZED DB */}
                    <DiagramNode
                        x={620}
                        y={170}
                        w={200}
                        h={40}
                        id="h1-season"
                        flows="live snapshot seed refresh"
                        category="cat-norm"
                        label="h1_season"
                        activeView={activeView}
                        onSelect={handleNodeSelect}
                    />
                    <DiagramNode
                        x={620}
                        y={222}
                        w={200}
                        h={48}
                        id="h1-live"
                        flows="live read-map read-stats"
                        category="cat-norm"
                        label="h1_live"
                        sublabel="campaigns + stats + map"
                        activeView={activeView}
                        onSelect={handleNodeSelect}
                    />
                    <DiagramNode
                        x={620}
                        y={282}
                        w={200}
                        h={40}
                        id="h1-event"
                        flows="live snapshot seed refresh read-events"
                        category="cat-norm"
                        label="h1_event"
                        activeView={activeView}
                        onSelect={handleNodeSelect}
                    />
                    <DiagramNode
                        x={620}
                        y={334}
                        w={200}
                        h={40}
                        id="h1-intro"
                        flows="live snapshot seed refresh"
                        category="cat-norm"
                        label="h1_introduction_order"
                        activeView={activeView}
                        onSelect={handleNodeSelect}
                    />
                    <DiagramNode
                        x={620}
                        y={386}
                        w={200}
                        h={40}
                        id="h1-points"
                        flows="live snapshot seed refresh"
                        category="cat-norm"
                        label="h1_points_max"
                        activeView={activeView}
                        onSelect={handleNodeSelect}
                    />

                    {/* LAYER 5: FRONTEND */}
                    <DiagramNode
                        x={920}
                        y={222}
                        w={160}
                        h={72}
                        id="fe-live"
                        flows="read-map read-stats"
                        category="cat-frontend"
                        label="Live Dashboard"
                        sublabel="map + stats + players"
                        sublabel2="reads h1_live (3 rows)"
                        activeView={activeView}
                        onSelect={handleNodeSelect}
                    />
                    <DiagramNode
                        x={920}
                        y={310}
                        w={160}
                        h={52}
                        id="fe-events"
                        flows="read-events"
                        category="cat-frontend"
                        label="Event Alerts"
                        sublabel="active defend/attack"
                        activeView={activeView}
                        onSelect={handleNodeSelect}
                    />

                    {/* ARROWS: Data Sources → Processing */}
                    <DiagramArrow
                        d="M220,68 L340,68"
                        flows="live"
                        arrowClass="arrow-api"
                        markerEnd="url(#ah-blue)"
                        activeView={activeView}
                    />
                    <DiagramArrow
                        d="M220,158 L310,158 Q330,158 330,138 L330,100 Q330,83 340,83"
                        flows="snapshot"
                        arrowClass="arrow-api"
                        markerEnd="url(#ah-blue)"
                        activeView={activeView}
                    />
                    <DiagramArrow
                        d="M220,288 L340,288"
                        flows="seed"
                        arrowClass="arrow-seed"
                        markerEnd="url(#ah-pink)"
                        activeView={activeView}
                    />
                    <DiagramArrow
                        d="M220,378 L340,378"
                        flows="refresh"
                        arrowClass="arrow-api"
                        markerEnd="url(#ah-blue)"
                        activeView={activeView}
                    />

                    {/* ARROWS: Processing → Raw Cache */}
                    <DiagramArrow
                        d="M520,60 L620,54"
                        flows="live"
                        arrowClass="arrow-amber"
                        markerEnd="url(#ah-amber)"
                        activeView={activeView}
                    />
                    <DiagramArrow
                        d="M520,80 L580,80 Q600,80 600,100 L600,114 L620,114"
                        flows="snapshot"
                        arrowClass="arrow-amber"
                        markerEnd="url(#ah-amber)"
                        activeView={activeView}
                    />

                    {/* ARROWS: Worker → Normalized */}
                    <DiagramArrow
                        d="M520,70 L570,70 Q590,70 590,170 L590,190 L620,190"
                        flows="live"
                        arrowClass="arrow-green"
                        markerEnd="url(#ah-green)"
                        activeView={activeView}
                    />
                    <DiagramArrow
                        d="M520,75 L565,75 Q585,75 585,200 L585,246 L620,246"
                        flows="live"
                        arrowClass="arrow-green"
                        markerEnd="url(#ah-green)"
                        activeView={activeView}
                    />
                    <DiagramArrow
                        d="M520,80 L560,80 Q580,80 580,240 L580,302 L620,302"
                        flows="live"
                        arrowClass="arrow-green"
                        markerEnd="url(#ah-green)"
                        activeView={activeView}
                    />
                    <DiagramArrow
                        d="M520,85 L555,85 Q575,85 575,280 L575,354 L620,354"
                        flows="live"
                        arrowClass="arrow-green"
                        markerEnd="url(#ah-green)"
                        activeView={activeView}
                    />
                    <DiagramArrow
                        d="M520,90 L550,90 Q570,90 570,320 L570,406 L620,406"
                        flows="live"
                        arrowClass="arrow-green"
                        markerEnd="url(#ah-green)"
                        activeView={activeView}
                    />

                    {/* ARROWS: Snapshot → Normalized */}
                    <DiagramArrow
                        d="M520,90 L560,90 Q575,90 575,240 L575,302 L620,302"
                        flows="snapshot"
                        arrowClass="arrow-green"
                        markerEnd="url(#ah-green)"
                        activeView={activeView}
                    />
                    <DiagramArrow
                        d="M520,95 L555,95 Q570,95 570,300 L570,354 L620,354"
                        flows="snapshot"
                        arrowClass="arrow-green"
                        markerEnd="url(#ah-green)"
                        activeView={activeView}
                    />
                    <DiagramArrow
                        d="M520,100 L550,100 Q565,100 565,340 L565,406 L620,406"
                        flows="snapshot"
                        arrowClass="arrow-green"
                        markerEnd="url(#ah-green)"
                        activeView={activeView}
                    />

                    {/* ARROWS: Seed → Normalized */}
                    <DiagramArrow
                        d="M520,275 L570,275 Q590,275 590,200 L590,190 L620,190"
                        flows="seed"
                        arrowClass="arrow-seed"
                        markerEnd="url(#ah-pink)"
                        activeView={activeView}
                    />
                    <DiagramArrow
                        d="M520,280 L565,280 Q580,280 580,302 L620,302"
                        flows="seed"
                        arrowClass="arrow-seed"
                        markerEnd="url(#ah-pink)"
                        activeView={activeView}
                        dashed
                    />
                    <DiagramArrow
                        d="M520,285 L560,285 Q575,285 575,340 L575,354 L620,354"
                        flows="seed"
                        arrowClass="arrow-seed"
                        markerEnd="url(#ah-pink)"
                        activeView={activeView}
                        dashed
                    />
                    <DiagramArrow
                        d="M520,290 L555,290 Q570,290 570,380 L570,406 L620,406"
                        flows="seed"
                        arrowClass="arrow-seed"
                        markerEnd="url(#ah-pink)"
                        activeView={activeView}
                        dashed
                    />

                    {/* ARROWS: Refresh → Raw + Normalized */}
                    <DiagramArrow
                        d="M520,365 L580,365 Q600,365 600,140 L600,114 L620,114"
                        flows="refresh"
                        arrowClass="arrow-amber"
                        markerEnd="url(#ah-amber)"
                        activeView={activeView}
                    />
                    <DiagramArrow
                        d="M520,370 L570,370 Q585,370 585,200 L585,190 L620,190"
                        flows="refresh"
                        arrowClass="arrow-green"
                        markerEnd="url(#ah-green)"
                        activeView={activeView}
                    />
                    <DiagramArrow
                        d="M520,375 L565,375 Q580,375 580,302 L620,302"
                        flows="refresh"
                        arrowClass="arrow-green"
                        markerEnd="url(#ah-green)"
                        activeView={activeView}
                    />
                    <DiagramArrow
                        d="M520,380 L560,380 Q575,375 575,354 L620,354"
                        flows="refresh"
                        arrowClass="arrow-green"
                        markerEnd="url(#ah-green)"
                        activeView={activeView}
                    />
                    <DiagramArrow
                        d="M520,385 L555,385 Q570,385 570,406 L620,406"
                        flows="refresh"
                        arrowClass="arrow-green"
                        markerEnd="url(#ah-green)"
                        activeView={activeView}
                    />

                    {/* ARROWS: DB → Frontend */}
                    <DiagramArrow
                        d="M820,246 L880,246 Q900,246 900,260 L900,268 L920,268"
                        flows="read-map read-stats"
                        arrowClass="arrow-frontend"
                        markerEnd="url(#ah-cyan)"
                        activeView={activeView}
                    />
                    <DiagramArrow
                        d="M820,302 L880,302 Q900,302 900,340 L900,364 L920,364"
                        flows="read-events"
                        arrowClass="arrow-frontend"
                        markerEnd="url(#ah-cyan)"
                        activeView={activeView}
                    />

                    {/* ANNOTATIONS */}
                    <Annotation
                        x={265}
                        y={53}
                        bgW={60}
                        text="5-15s"
                        flows="live"
                        activeView={activeView}
                    />
                    <Annotation
                        x={265}
                        y={159}
                        bgW={60}
                        text="~1h"
                        flows="snapshot"
                        activeView={activeView}
                    />
                    <Annotation
                        x={265}
                        y={289}
                        bgW={60}
                        text="once"
                        flows="seed"
                        activeView={activeView}
                    />
                    <Annotation
                        x={271}
                        y={379}
                        bgW={72}
                        text="on demand"
                        flows="refresh"
                        activeView={activeView}
                    />
                    <Annotation
                        x={583}
                        y={41}
                        bgW={56}
                        text="upsert"
                        flows="live snapshot"
                        activeView={activeView}
                    />
                    <Annotation
                        x={873}
                        y={235}
                        bgW={56}
                        text="read"
                        flows="read-map read-stats read-events"
                        activeView={activeView}
                    />
                </svg>
            </div>

            {/* Legend */}
            <div className="diagram-legend">
                {LEGEND.map((item) => (
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
            <DetailPanel nodeId={selectedNode} onClose={handleCloseDetail} />
        </div>
    );
}
