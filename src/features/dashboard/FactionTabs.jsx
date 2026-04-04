'use client';
import './FactionTabs.css';

const TABS = [
    { id: 'global', label: 'Global', icon: '/icons/faction3.webp' },
    { id: 'bugs', label: 'Bugs', icon: '/icons/faction0.webp' },
    { id: 'cyborgs', label: 'Cyborgs', icon: '/icons/faction1.webp' },
    { id: 'illuminate', label: 'Illuminate', icon: '/icons/faction2.webp' },
];

export default function FactionTabs({ active, onChange }) {
    return (
        <div className="faction-tabs">
            {TABS.map(({ id, label, icon }) => (
                <button
                    key={id}
                    className={`faction-tab ${active === id ? 'active' : ''}`}
                    onClick={() => onChange(id)}
                    aria-label={label}
                >
                    <img src={icon} alt="" className="faction-tab-icon" />
                    <span className="faction-tab-label">{label}</span>
                </button>
            ))}
        </div>
    );
}
