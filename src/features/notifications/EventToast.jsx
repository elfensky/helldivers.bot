import { toast } from 'sonner';
import Image from 'next/image';
import factions from '@/shared/enums/factions.mjs';
import { FACTION_COLORS } from '@/shared/enums/colors.mjs';
import { getEventRegionLabel } from '@/shared/utils/game/getEventRegionLabel.mjs';
import { EVENT_TYPE } from '@/shared/enums/events.mjs';

/** @typedef {import('@/shared/enums/events.mjs').Event} Event */
/** @typedef {import('@/shared/enums/events.mjs').EventChangeKind} EventChangeKind */

/**
 * Build title + subtitle for a toast based on event kind and type.
 *
 * @param {EventChangeKind} kind - Event lifecycle stage the toast represents.
 * @param {Event} event - The event the toast describes.
 * @returns {{ title: string, subtitle: string }}
 */
export function toastLabel(kind, event) {
    const region = getEventRegionLabel(event);
    const isDefend = event.type === EVENT_TYPE.DEFEND;

    const titles = {
        event_started: isDefend ? `${region} under attack` : `Capturing ${region}`,
        event_won: isDefend ? `${region} defended` : `${region} captured`,
        event_lost: isDefend ? `${region} lost` : `${region} held`,
        catch_up: isDefend ? `${region} under attack` : `Capturing ${region}`,
    };

    const subtitles = {
        event_started: `${isDefend ? 'Defend' : 'Attack'} event started`,
        event_won: `${isDefend ? 'Defend' : 'Attack'} event won!`,
        event_lost: `${isDefend ? 'Defend' : 'Attack'} event lost`,
        catch_up: `${isDefend ? 'Defend' : 'Attack'} event in progress`,
    };

    return {
        title: titles[kind] ?? `${region}`,
        subtitle: subtitles[kind] ?? 'Campaign update',
    };
}

/** Build the JSX element passed as Sonner's first argument. */
function ToastContent({ event, kind }) {
    const { title, subtitle } = toastLabel(kind, event);
    const icon = factions[event.enemy]?.icon;

    // Live-event titles pulse their action word, matching the card titles.
    const FLASH_PREFIX = 'Capturing ';
    const flashes =
        (kind === 'event_started' || kind === 'catch_up') &&
        title.startsWith(FLASH_PREFIX);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {icon && <Image src={icon} alt="" width={24} height={24} />}
            <div>
                <div style={{ fontWeight: 600 }}>
                    {flashes ?
                        <>
                            <span className="toast-action-flash">Capturing</span>{' '}
                            {title.slice(FLASH_PREFIX.length)}
                        </>
                    :   title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {subtitle}
                </div>
            </div>
            <span className="toast-accent" />
        </div>
    );
}

/**
 * Show (or replace) an event toast with faction-colored blinking accent border.
 *
 * @param {Event} event - The event to show a toast for.
 * @param {EventChangeKind} kind - Event lifecycle stage the toast represents.
 * @param {object}  [opts] - Optional toast appearance overrides.
 * @param {number}  [opts.duration]    - Sonner duration (default Infinity).
 * @param {string}  [opts.alertColor]  - Action-word flash color (default danger).
 * @param {number}  [opts.pulseDelay]  - Animation delay in seconds for per-event offset.
 * @param {import('sonner').ToastT['onDismiss']} [opts.onDismiss]  - Called when toast is dismissed.
 */
export function showEventToast(
    event,
    kind,
    {
        duration = Infinity,
        alertColor = 'var(--color-danger)',
        pulseDelay,
        onDismiss,
    } = {},
) {
    const factionColor = FACTION_COLORS[event.enemy];

    // CSS custom properties aren't in the CSSProperties type — cast intentionally.
    const style = /** @type {import('react').CSSProperties & Record<string, string>} */ ({
        '--faction-color': factionColor,
        '--alert-color': alertColor,
    });
    if (pulseDelay != null) style['--pulse-delay'] = `${pulseDelay}s`;

    toast(<ToastContent event={event} kind={kind} />, {
        id: `event-${event.event_id}`,
        duration,
        style,
        onDismiss,
    });
}
