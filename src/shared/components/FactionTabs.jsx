'use client';

import Image from 'next/image';
import Button from '@/shared/components/Button/Button';
import { useTrack } from '@/shared/hooks/useTrack.mjs';

const TABS = [
    {
        id: 'global',
        label: 'Global',
        icon: '/icons/faction3.webp',
        variant: 'primary',
    },
    {
        id: 'bugs',
        label: 'Bugs',
        icon: '/icons/faction0.webp',
        variant: 'faction-bugs',
    },
    {
        id: 'cyborgs',
        label: 'Cyborgs',
        icon: '/icons/faction1.webp',
        variant: 'faction-cyborgs',
    },
    {
        id: 'illuminate',
        label: 'Illuminate',
        icon: '/icons/faction2.webp',
        variant: 'faction-illuminate',
    },
];

export default function FactionTabs({ active, onChange }) {
    const track = useTrack();
    return (
        <div className="inline-flex gap-1">
            {TABS.map(({ id, label, icon, variant }) => (
                <Button
                    key={id}
                    size="icon"
                    variant={variant}
                    active={active === id}
                    onClick={() => {
                        onChange(id);
                        track('faction-tab-switch', { faction: id });
                    }}
                    aria-label={label}
                    aria-pressed={active === id}
                    data-umami-event={`faction-toggle-${id}`}
                >
                    <Image
                        src={icon}
                        alt=""
                        width={26}
                        height={26}
                        className="size-[26px] object-contain md:size-[18px]"
                    />
                </Button>
            ))}
        </div>
    );
}
