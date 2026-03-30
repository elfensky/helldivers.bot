// src/components/h1/WarSummary/WarSummary.jsx
import './WarSummary.css';

export function computeWarSummary(events) {
    let wins = 0;
    let losses = 0;
    for (const e of events ?? []) {
        if (e.status === 'success') wins++;
        else if (e.status === 'fail') losses++;
    }
    return { wins, losses };
}

export default function WarSummary({ events }) {
    const { wins, losses } = computeWarSummary(events);

    if (wins === 0 && losses === 0) return null;

    return (
        <div className="war-summary">
            <span className="war-summary-label">Season Events</span>
            <div className="war-summary-counts">
                <span className="war-summary-wins">{wins}W</span>
                <span className="war-summary-sep">/</span>
                <span className="war-summary-losses">{losses}L</span>
            </div>
        </div>
    );
}
