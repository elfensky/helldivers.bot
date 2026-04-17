'use client';
import './RegionsViewToggle.css';

const OPTIONS = [
    { value: 'sector', label: 'Sector' },
    { value: 'campaign', label: 'Campaign' },
];

export default function RegionsViewToggle({ value, onChange }) {
    return (
        <div className="regions-toggle" role="tablist" aria-label="Regions view">
            {OPTIONS.map((opt) => {
                const active = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        className={'regions-toggle-btn' + (active ? ' active' : '')}
                        onClick={() => onChange(opt.value)}
                        data-umami-event={`regions-view-${opt.value}`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
