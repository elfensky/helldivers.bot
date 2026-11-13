// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

import {
    REPLAY_CONSENT_KEY,
    canReplay,
    privacySignal,
    readReplayConsent,
    replayAllowed,
    writeReplayConsent,
} from '@/features/consent/replayConsent.mjs';
import { OPT_OUT_KEY } from '@/shared/components/AnalyticsOptOut';

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    vi.unstubAllGlobals();
    delete navigator.globalPrivacyControl;
    delete navigator.doNotTrack;
    delete window.doNotTrack;
});

describe('readReplayConsent / writeReplayConsent', () => {
    test('no answer reads as undefined', async () => {
        expect(await readReplayConsent()).toBeUndefined();
    });

    test('a stored yes or no reads back; null clears it', async () => {
        expect(await writeReplayConsent('yes')).toBe(true);
        expect(await readReplayConsent()).toBe('yes');
        await writeReplayConsent('no');
        expect(await readReplayConsent()).toBe('no');
        await writeReplayConsent(null);
        expect(await readReplayConsent()).toBeUndefined();
    });

    test.each(['1', 'true', 'YES', ''])(
        'the stored value %j reads as no answer',
        async (v) => {
            localStorage.setItem(REPLAY_CONSENT_KEY, v);
            expect(await readReplayConsent()).toBeUndefined();
        },
    );

    test('blocked storage: read resolves null, write resolves false', async () => {
        vi.stubGlobal('localStorage', {
            getItem: () => {
                throw new Error('SecurityError');
            },
            setItem: () => {
                throw new Error('SecurityError');
            },
        });
        expect(await readReplayConsent()).toBeNull();
        expect(await writeReplayConsent('yes')).toBe(false);
    });
});

describe('canReplay', () => {
    const yes = { consent: 'yes', optOut: false, identified: false, signal: false };

    test('only a yes, no opt-out, no account link and no signal allows replay', () => {
        expect(canReplay(yes)).toBe(true);
    });

    test.each([
        ['no answer', { consent: undefined }],
        ['blocked consent storage', { consent: null }],
        ['a no', { consent: 'no' }],
        ['opted out', { optOut: true }],
        ['blocked opt-out storage', { optOut: null }],
        ['the account link on', { identified: true }],
        ['a privacy signal', { signal: true }],
    ])('%s keeps replay off', (_, change) => {
        expect(canReplay({ ...yes, ...change })).toBe(false);
    });
});

describe('privacySignal', () => {
    test('false without a signal', () => {
        expect(privacySignal()).toBe(false);
    });

    test('true with Global Privacy Control', () => {
        Object.defineProperty(navigator, 'globalPrivacyControl', {
            value: true,
            configurable: true,
        });
        expect(privacySignal()).toBe(true);
    });

    test('true with navigator.doNotTrack = "1"', () => {
        Object.defineProperty(navigator, 'doNotTrack', {
            value: '1',
            configurable: true,
        });
        expect(privacySignal()).toBe(true);
    });

    test('true with window.doNotTrack = "1"', () => {
        window.doNotTrack = '1';
        expect(privacySignal()).toBe(true);
    });
});

describe('replayAllowed', () => {
    test('reads the stored yes and the opt-out flag', async () => {
        expect(await replayAllowed(false)).toBe(false);
        await writeReplayConsent('yes');
        expect(await replayAllowed(false)).toBe(true);
        expect(await replayAllowed(true)).toBe(false);
        localStorage.setItem(OPT_OUT_KEY, '1');
        expect(await replayAllowed(false)).toBe(false);
    });
});
