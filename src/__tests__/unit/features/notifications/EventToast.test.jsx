// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// eventToast has two public surfaces:
//   - toastLabel(kind, event): pure function — easy to test directly
//   - showEventToast(event, kind, opts): calls sonner's toast(jsx, opts) and
//     toggles a module-level flashToggle. We mock 'sonner' to capture what
//     was passed and assert against it.

vi.mock('sonner', () => ({
    toast: vi.fn(),
}));

vi.mock('@/shared/utils/game/getEventRegionLabel.mjs', () => ({
    getEventRegionLabel: vi.fn((event) => `Region-${event.region}`),
}));

vi.mock('@/shared/enums/factions.mjs', () => ({
    default: {
        0: { name: 'Bugs', icon: '/icons/faction0.webp' },
        1: { name: 'Cyborgs', icon: '/icons/faction1.webp' },
        2: { name: 'Illuminate', icon: '/icons/faction2.webp' },
    },
}));

vi.mock('@/shared/enums/colors.mjs', () => ({
    FACTION_COLORS: {
        0: '#E8822A',
        1: '#8B2D2D',
        2: '#7EC8E3',
    },
}));

import { toast } from 'sonner';
import { toastLabel, showEventToast } from '@/features/notifications/EventToast';

beforeEach(() => {
    vi.mocked(toast).mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('toastLabel — attack events', () => {
    const attackEvent = { enemy: 0, region: 5, type: 'attack' };

    test('event_started: title says "Capturing <region>"; subtitle confirms attack started', () => {
        const { title, subtitle } = toastLabel('event_started', attackEvent);
        expect(title).toBe('Capturing Region-5');
        expect(subtitle).toBe('Attack event started');
    });

    test('event_won: title says "<region> captured"', () => {
        const { title, subtitle } = toastLabel('event_won', attackEvent);
        expect(title).toBe('Region-5 captured');
        expect(subtitle).toBe('Attack event won!');
    });

    test('event_lost: title says "<region> held" (the attack failed — region was held by defender)', () => {
        const { title, subtitle } = toastLabel('event_lost', attackEvent);
        expect(title).toBe('Region-5 held');
        expect(subtitle).toBe('Attack event lost');
    });

    test('catch_up: title says "Capturing <region>" (matches event_started but with progress subtitle)', () => {
        const { title, subtitle } = toastLabel('catch_up', attackEvent);
        expect(title).toBe('Capturing Region-5');
        expect(subtitle).toBe('Attack event in progress');
    });
});

describe('toastLabel — defend events', () => {
    const defendEvent = { enemy: 1, region: 11, type: 'defend' };

    test('event_started: title says "<region> under attack"', () => {
        const { title, subtitle } = toastLabel('event_started', defendEvent);
        expect(title).toBe('Region-11 under attack');
        expect(subtitle).toBe('Defend event started');
    });

    test('event_won: title says "<region> defended"', () => {
        const { title, subtitle } = toastLabel('event_won', defendEvent);
        expect(title).toBe('Region-11 defended');
        expect(subtitle).toBe('Defend event won!');
    });

    test('event_lost: title says "<region> lost" (defense failed)', () => {
        const { title, subtitle } = toastLabel('event_lost', defendEvent);
        expect(title).toBe('Region-11 lost');
        expect(subtitle).toBe('Defend event lost');
    });

    test('catch_up: title matches event_started but subtitle says "in progress"', () => {
        const { title, subtitle } = toastLabel('catch_up', defendEvent);
        expect(title).toBe('Region-11 under attack');
        expect(subtitle).toBe('Defend event in progress');
    });
});

describe('toastLabel — fallbacks', () => {
    test('unknown kind returns plain region as title + generic subtitle', () => {
        const event = { enemy: 0, region: 1, type: 'attack' };
        const { title, subtitle } = toastLabel('weird_unknown_kind', event);
        expect(title).toBe('Region-1');
        expect(subtitle).toBe('Campaign update');
    });
});

describe('showEventToast — toast call shape', () => {
    test('calls sonner toast() exactly once per invocation', () => {
        showEventToast(
            { event_id: 42, enemy: 0, region: 5, type: 'attack' },
            'event_started',
        );
        expect(toast).toHaveBeenCalledTimes(1);
    });

    test('passes the toast id formatted as "event-<event_id>" so re-showing the same event replaces in-place', () => {
        showEventToast(
            { event_id: 99, enemy: 0, region: 1, type: 'attack' },
            'event_started',
        );
        const [, opts] = toast.mock.calls[0];
        expect(opts.id).toBe('event-99');
    });

    test('default duration is Infinity (event toasts persist until dismissed)', () => {
        showEventToast(
            { event_id: 1, enemy: 0, region: 1, type: 'attack' },
            'event_started',
        );
        const [, opts] = toast.mock.calls[0];
        expect(opts.duration).toBe(Infinity);
    });

    test('custom duration is forwarded to sonner', () => {
        showEventToast(
            { event_id: 1, enemy: 0, region: 1, type: 'attack' },
            'event_started',
            { duration: 5000 },
        );
        expect(toast.mock.calls[0][1].duration).toBe(5000);
    });

    test('forwards onDismiss callback to sonner', () => {
        const onDismiss = vi.fn();
        showEventToast(
            { event_id: 1, enemy: 0, region: 1, type: 'attack' },
            'event_started',
            { onDismiss },
        );
        expect(toast.mock.calls[0][1].onDismiss).toBe(onDismiss);
    });
});

describe('showEventToast — style wiring', () => {
    test('--faction-color is taken from FACTION_COLORS[event.enemy]', () => {
        showEventToast(
            { event_id: 1, enemy: 1, region: 1, type: 'attack' },
            'event_started',
        );
        const [, opts] = toast.mock.calls[0];
        expect(opts.style['--faction-color']).toBe('#8B2D2D');
    });

    test('default --alert-color is var(--color-danger)', () => {
        showEventToast(
            { event_id: 1, enemy: 0, region: 1, type: 'attack' },
            'event_started',
        );
        const [, opts] = toast.mock.calls[0];
        expect(opts.style['--alert-color']).toBe('var(--color-danger)');
    });

    test('custom alertColor option overrides the alert color', () => {
        showEventToast(
            { event_id: 1, enemy: 0, region: 1, type: 'attack' },
            'event_started',
            { alertColor: '#facc15' },
        );
        const [, opts] = toast.mock.calls[0];
        expect(opts.style['--alert-color']).toBe('#facc15');
    });

    test('--pulse-delay only set when pulseDelay is provided', () => {
        showEventToast(
            { event_id: 1, enemy: 0, region: 1, type: 'attack' },
            'event_started',
        );
        expect(toast.mock.calls[0][1].style).not.toHaveProperty('--pulse-delay');

        showEventToast(
            { event_id: 2, enemy: 0, region: 1, type: 'attack' },
            'event_started',
            { pulseDelay: 1.25 },
        );
        expect(toast.mock.calls[1][1].style['--pulse-delay']).toBe('1.25s');
    });
});

describe('showEventToast — accent is static, the title action word flashes', () => {
    test('ToastContent carries no accent alternation props (accent is a static span)', () => {
        showEventToast(
            { event_id: 1, enemy: 0, region: 1, type: 'attack' },
            'event_started',
        );
        const [jsx] = toast.mock.calls.at(-1);
        expect(jsx.props.accentClass).toBeUndefined();
    });
});
