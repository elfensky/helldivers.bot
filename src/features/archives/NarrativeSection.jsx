'use client';

import { useState } from 'react';
import Button from '@/shared/components/Button/Button';

/**
 * War Narrative — a collapsible, in-world chronicle of a season's campaign in
 * the Ministry of Truth's propaganda voice. The beats are computed server-side
 * (see buildWarNarrative + the archives page) and passed in; this component
 * only renders + toggles. Renders nothing when there is no narrative to tell.
 *
 * A primary (yellow-bordered, square) Button toggles the body, reading SHOW
 * when collapsed and HIDE when expanded.
 *
 * @param {object} props - Component props.
 * @param {Array<{ day:number, text:string }>} [props.beats] - Server-computed beats.
 * @param {boolean} [props.defaultOpen] - Whether the section starts expanded.
 */
export default function NarrativeSection({ beats, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    if (!beats?.length) return null;

    return (
        <section className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <h2 className="m-0">War Narrative</h2>
                <Button
                    variant="primary"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    data-umami-event="archive-narrative-toggle"
                >
                    {open ? 'HIDE' : 'SHOW'}
                </Button>
            </div>

            <p className="text-small text-text-muted">
                The official record of the campaign, as approved for citizen consumption
                by the Ministry of Truth.
            </p>

            {open && (
                <ol className="flex flex-col gap-2">
                    {beats.map((beat, i) => (
                        <li
                            key={i}
                            className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 border-l-4 border-ghost bg-surface-1 px-3 py-2"
                        >
                            <span className="font-mono text-small font-bold tracking-wide text-text-muted uppercase">
                                Day {beat.day}
                            </span>
                            <span className="text-body text-text">{beat.text}</span>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
