'use client';

import ToggleButton from '@/shared/components/ToggleButton/ToggleButton';
import { useTrack } from '@/shared/hooks/useTrack.mjs';

const TABS = [
    {
        id: 'global',
        label: 'Global',
        icon: '/icons/faction3.webp',
        borderColor: 'primary',
    },
    {
        id: 'bugs',
        label: 'Bugs',
        icon: '/icons/faction0.webp',
        borderColor: 'faction-bugs',
    },
    {
        id: 'cyborgs',
        label: 'Cyborgs',
        icon: '/icons/faction1.webp',
        borderColor: 'faction-cyborgs',
    },
    {
        id: 'illuminate',
        label: 'Illuminate',
        icon: '/icons/faction2.webp',
        borderColor: 'faction-illuminate',
    },
];

export default function FactionTabs({ active, onChange }) {
    const track = useTrack();
    return (
        <div className="inline-flex gap-1">
            {TABS.map(({ id, label, icon, borderColor }) => (
                <ToggleButton
                    key={id}
                    active={active === id}
                    onClick={() => {
                        onChange(id);
                        track('faction-tab-switch', { faction: id });
                    }}
                    borderColor={borderColor}
                    aria-label={label}
                    aria-pressed={active === id}
                    data-umami-event={`faction-toggle-${id}`}
                >
                    <img
                        src={icon}
                        alt=""
                        className="size-[26px] object-contain md:size-[18px]"
                    />
                </ToggleButton>
            ))}
        </div>
    );
}
