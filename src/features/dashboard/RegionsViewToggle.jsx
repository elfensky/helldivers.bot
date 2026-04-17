'use client';

import Button from '@/shared/components/Button/Button';

/**
 * Small square icon toggle for the Regions section. Switches between
 * 'sector' (single-bar, active-sector zoom) and 'campaign' (11-segment
 * full-war bar).
 */
export default function RegionsViewToggle({ value, onChange }) {
    const isCampaign = value === 'campaign';
    const next = isCampaign ? 'sector' : 'campaign';
    const label =
        isCampaign ?
            'Switch to sector view (single-bar)'
        :   'Switch to campaign view (11-segment bar)';

    return (
        <Button
            size="icon"
            variant="primary"
            active={isCampaign}
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
                {/* 3 uniform vertical bars — reads as "segmented bars" */}
                <rect x="2" y="2" width="2" height="10" fill="currentColor" />
                <rect x="6" y="2" width="2" height="10" fill="currentColor" />
                <rect x="10" y="2" width="2" height="10" fill="currentColor" />
            </svg>
        </Button>
    );
}
