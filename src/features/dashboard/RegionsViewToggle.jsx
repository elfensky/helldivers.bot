'use client';
import './RegionsViewToggle.css';

/**
 * Small square icon toggle for the Regions section. Switches between
 * 'sector' (single-bar, active-sector zoom) and 'campaign' (11-segment
 * full-war bar). The icon depicts the segmented campaign bar; it renders
 * filled when campaign view is active and outlined otherwise.
 */
export default function RegionsViewToggle({ value, onChange }) {
    const isCampaign = value === 'campaign';
    const next = isCampaign ? 'sector' : 'campaign';
    const label =
        isCampaign ?
            'Switch to sector view (single-bar)'
        :   'Switch to campaign view (11-segment bar)';

    return (
        <button
            type="button"
            className={'regions-toggle' + (isCampaign ? ' regions-toggle--active' : '')}
            onClick={() => onChange(next)}
            aria-label={label}
            aria-pressed={isCampaign}
            title={label}
            data-umami-event={`regions-view-${next}`}
        >
            <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                aria-hidden="true"
                focusable="false"
            >
                {/* 11 stylised segments; 3 filled to imply a partial campaign. */}
                <rect x="0" y="6" width="1" height="2" />
                <rect x="1.25" y="6" width="1" height="2" />
                <rect x="2.5" y="6" width="1" height="2" />
                <rect x="3.75" y="6" width="1" height="2" className="seg--dim" />
                <rect x="5" y="6" width="1" height="2" className="seg--dim" />
                <rect x="6.25" y="6" width="1" height="2" className="seg--dim" />
                <rect x="7.5" y="6" width="1" height="2" className="seg--dim" />
                <rect x="8.75" y="6" width="1" height="2" className="seg--dim" />
                <rect x="10" y="6" width="1" height="2" className="seg--dim" />
                <rect x="11.25" y="6" width="1" height="2" className="seg--dim" />
                <rect x="12.5" y="6" width="1" height="2" className="seg--dim" />
            </svg>
        </button>
    );
}
