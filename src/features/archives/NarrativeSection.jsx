'use client';

import { buildWarNarrative } from '@/features/archives/buildWarNarrative.mjs';

/**
 * War Narrative — a collapsible, in-world chronicle of a season's campaign,
 * generated chronologically from event data in the Ministry of Truth's
 * propaganda voice. Renders nothing when there is no narrative to tell
 * (hide-when-empty, matching the player-engagement section).
 *
 * Uses the native `<details>`/`<summary>` collapsible idiom established by the
 * docs `EndpointCard` — no JS toggle state, keyboard-accessible for free. The
 * heading reuses the `.event-log-section` visual language so it reads as one
 * archives section alongside the Event Log and Cascade Failures.
 *
 * @param {object} props - Component props.
 * @param {object} props.data - Campaign data (the getCampaign shape).
 * @param {boolean} [props.defaultOpen] - Whether the section starts expanded.
 */
export default function NarrativeSection({ data, defaultOpen = false }) {
    const beats = buildWarNarrative(data);
    if (beats.length === 0) return null;

    return (
        <section className="mt-4 flex flex-col gap-2">
            <details className="group" open={defaultOpen}>
                <summary
                    className="flex cursor-pointer list-none items-center justify-between gap-2"
                    data-umami-event="archive-narrative-toggle"
                >
                    <h2 className="m-0">War Narrative</h2>
                    <span
                        aria-hidden="true"
                        className="font-mono text-small text-text-muted transition-transform group-open:rotate-90"
                    >
                        ▸
                    </span>
                </summary>

                <p className="mt-2 text-small text-text-muted">
                    The official record of the campaign, as approved for citizen
                    consumption by the Ministry of Truth.
                </p>

                <ol className="mt-3 flex flex-col gap-2">
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
            </details>
        </section>
    );
}
