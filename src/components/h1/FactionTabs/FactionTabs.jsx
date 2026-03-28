'use client';
import './FactionTabs.css';

const TABS = [
    { id: 'global', label: 'Global' },
    { id: 'bugs', label: 'Bugs' },
    { id: 'cyborgs', label: 'Cyborgs' },
    { id: 'illuminate', label: 'Illuminate' },
];

export default function FactionTabs({ active, onChange }) {
    return (
        <div className="faction-tabs">
            {TABS.map(({ id, label }) => (
                <button
                    key={id}
                    className={`faction-tab ${active === id ? 'active' : ''}`}
                    onClick={() => onChange(id)}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
