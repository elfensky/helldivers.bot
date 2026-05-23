'use client';

import { Fragment } from 'react';
import './EventLog.css';
import CascadeLogCard from '@/features/timeline/CascadeLogCard';
import CascadeLogSortToggle from '@/features/timeline/CascadeLogSortToggle';
import { useCascadeLogSort } from '@/features/timeline/useCascadeLogSort.mjs';
import { groupCascadesBySeason } from '@/features/timeline/groupCascadesBySeason.mjs';

/**
 * Cross-season cascade log. Same section layout as EventLog, grouped by
 * season instead of by day. Renders nothing when `cascades` is empty.
 *
 * @param {object} props - Component props.
 * @param {Array<object>} props.cascades - Each cascade includes a `season` field.
 * @param {string} [props.lede] - Optional one-line summary above the groups.
 * @param {string} [props.title] - Optional heading text (defaults to "Cascade Failures").
 * @param {string} [props.id] - Optional DOM id (defaults to "cascade").
 * @param {'worst'|'recent'} [props.initialSortOrder] - Server-read sort preference.
 */
export default function CascadeLog({
    cascades,
    lede,
    title = 'Cascade Failures',
    id = 'cascade',
    initialSortOrder,
}) {
    const [sortOrder, toggleSortOrder] = useCascadeLogSort(initialSortOrder);
    if (!cascades?.length) return null;
    const groups = groupCascadesBySeason(cascades, { sortOrder });

    return (
        <section id={id} className="event-log-section">
            <div className="event-log-content">
                <div className="event-log-header">
                    <h2 className="event-log-heading">{title}</h2>
                    <CascadeLogSortToggle
                        sortOrder={sortOrder}
                        onToggle={toggleSortOrder}
                    />
                </div>
                {lede && <p className="event-log-lede">{lede}</p>}
                <div className="event-log-days">
                    {groups.map((group) => (
                        <Fragment key={group.season}>
                            <div className="event-log-day">
                                <div className="event-log-day-header">
                                    <span className="event-log-day-label">
                                        Season {group.season}
                                    </span>
                                    <span className="event-log-day-summary">
                                        {group.cascades.length} cascade
                                        {group.cascades.length === 1 ? '' : 's'}
                                    </span>
                                </div>
                                <div className="event-log-day-grid">
                                    {group.cascades.map((c, i) => (
                                        <CascadeLogCard
                                            key={`${group.season}-${c.startTime}-${i}`}
                                            cascade={c}
                                        />
                                    ))}
                                </div>
                            </div>
                        </Fragment>
                    ))}
                </div>
            </div>
        </section>
    );
}
