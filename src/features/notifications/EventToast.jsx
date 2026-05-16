import { toast } from 'sonner';
import factions from '@/shared/enums/factions.mjs';
import { FACTION_COLORS } from '@/shared/enums/colors.mjs';
import { getEventRegionLabel } from '@/shared/utils/game/getEventRegionLabel.mjs';
import { EVENT_TYPE } from '@/shared/enums/events.mjs';

/**
 * Build title + subtitle for a toast based on event kind and type.
 *
 * @param {'event_started'|'event_won'|'event_lost'|'catch_up'} kind
 * @param {{ enemy: number, region: number, type: string }} event
 * @returns {{ title: string, subtitle: string }}
 */
export function toastLabel(kind, event) {
    const region = getEventRegionLabel(event);
    const isDefend = event.type === EVENT_TYPE.DEFEND;

    const titles = {
        event_started: isDefend ? `${region} under attack` : `Attacking ${region}`,
        event_won: isDefend ? `${region} defended` : `${region} captured`,
        event_lost: isDefend ? `${region} lost` : `${region} held`,
        catch_up: isDefend ? `${region} under attack` : `Attacking ${region}`,
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
function ToastContent({ event, kind, accentClass }) {
    const { title, subtitle } = toastLabel(kind, event);
    const icon = factions[event.enemy]?.icon;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {icon && <img src={icon} alt="" width={24} height={24} />}
            <div>
                <div style={{ fontWeight: 600 }}>{title}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {subtitle}
                </div>
            </div>
            <span className={accentClass} />
        </div>
    );
}

/**
 * Module-level toggle that alternates between 'a' and 'b' to force
 * CSS animation restart when Sonner re-renders a toast in-place.
 */
let flashToggle = false;

/**
 * Show (or replace) an event toast with faction-colored blinking accent border.
 *
 * @param {{ id: string|number, enemy: number, region: number, type: string }} event
 * @param {'event_started'|'event_won'|'event_lost'|'catch_up'} kind
 * @param {Object}  [opts]
 * @param {number}  [opts.duration]    - Sonner duration (default Infinity)
 * @param {string}  [opts.alertColor]  - Blink overlay color (default danger)
 * @param {number}  [opts.pulseDelay]  - Animation delay in seconds for per-event offset
 * @param {Function} [opts.onDismiss]  - Called when toast is dismissed
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
    flashToggle = !flashToggle;
    const suffix = flashToggle ? 'a' : 'b';
    const accentClass = `toast-accent toast-accent--${suffix}`;

    const style = {
        '--faction-color': factionColor,
        '--alert-color': alertColor,
    };
    if (pulseDelay != null) style['--pulse-delay'] = `${pulseDelay}s`;

    toast(<ToastContent event={event} kind={kind} accentClass={accentClass} />, {
        id: `event-${event.event_id}`,
        duration,
        style,
        onDismiss,
    });
}
