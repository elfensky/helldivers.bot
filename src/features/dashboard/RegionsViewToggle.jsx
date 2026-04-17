'use client';

/**
 * Small square icon toggle for the Regions section. Switches between
 * 'sector' (single-bar, active-sector zoom) and 'campaign' (11-segment
 * full-war bar). Matches the brandkit button pattern used by
 * `EffectsToggle` in `ArchivesHeader.jsx` and `EventLogSortToggle`:
 * 30x30 yellow border, opacity-40 when the view isn't active.
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
            onClick={() => onChange(next)}
            aria-label={label}
            aria-pressed={isCampaign}
            title={label}
            data-umami-event={`regions-view-${next}`}
            className={
                'inline-flex size-[30px] cursor-pointer items-center justify-center ' +
                'border border-primary font-mono text-primary ' +
                'hover:bg-primary hover:text-surface-0 ' +
                (isCampaign ? '' : 'opacity-40')
            }
        >
            <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                aria-hidden="true"
                focusable="false"
            >
                {/* 3 uniform vertical bars — reads as "segmented bars" */}
                <rect x="2" y="2" width="2" height="10" fill="currentColor" />
                <rect x="6" y="2" width="2" height="10" fill="currentColor" />
                <rect x="10" y="2" width="2" height="10" fill="currentColor" />
            </svg>
        </button>
    );
}
