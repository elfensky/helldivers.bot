import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

import { deleteLinkedSessions } from '@/features/consent/umamiSessions.mjs';

const userId = '01908174-d3a5-7e50-b964-6f5e9e48c0a1';
const site = '9a916711-2868-43d2-9932-964fc9528824';
const s1 = '11111111-1111-4111-8111-111111111111';
const s2 = '22222222-2222-4222-8222-222222222222';
const s3 = '33333333-3333-4333-8333-333333333333';

const json = (body, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

/**
 * A fake Umami: `sessions` maps a session id to its linked distinct ids.
 *
 * @param {Record<string, string[]>} sessions - Session id → distinct ids.
 * @param {{ stitched?: number, deleteStatus?: number }} [opts] - Overrides.
 */
function fakeUmami(sessions, { stitched, deleteStatus = 200 } = {}) {
    const own = Object.values(sessions).filter((d) => d.includes(userId)).length;
    return vi.fn((url, init = {}) => {
        const path = new URL(url).pathname;
        if (init.method === 'DELETE') return json({ ok: true }, deleteStatus);
        const id = path.split('/').pop();
        if (id === 'sessions') {
            return json({
                data: Object.keys(sessions).map((sid) => ({ id: sid })),
                count: Object.keys(sessions).length,
                page: 1,
                pageSize: 100,
            });
        }
        return json({
            id,
            distinctIds: sessions[id],
            stitchedSessionCount: stitched ?? own,
        });
    });
}

beforeEach(() => {
    vi.stubEnv('UMAMI_SITE_URL', 'umami.example');
    vi.stubEnv('UMAMI_SITE_ID', site);
    vi.stubEnv('UMAMI_API_KEY', 'umami_test');
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('deleteLinkedSessions', () => {
    test('without an API key it does nothing and reports a failure', async () => {
        vi.stubEnv('UMAMI_API_KEY', '');
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        expect(await deleteLinkedSessions(userId)).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
    });

    test('searches by the account id and deletes only its own sessions', async () => {
        const fetch = fakeUmami({ [s1]: [userId], [s2]: [userId], [s3]: [] });
        vi.stubGlobal('fetch', fetch);

        expect(await deleteLinkedSessions(userId)).toBe(true);

        const list = new URL(fetch.mock.calls[0][0]);
        expect(list.pathname).toBe(`/api/websites/${site}/sessions`);
        expect(list.searchParams.get('search')).toBe(userId);
        expect(list.searchParams.get('startAt')).toBe('0');
        expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer umami_test');

        const deletes = fetch.mock.calls.filter(([, init]) => init?.method === 'DELETE');
        expect(deletes.map(([url]) => new URL(url).pathname.split('/').pop())).toEqual([
            s1,
            s2,
        ]);
        expect(deletes[0][1].headers.Authorization).toBe('Bearer umami_test');
    });

    test('a session shared with another distinct id is kept, and the call fails', async () => {
        const fetch = fakeUmami({ [s1]: [userId], [s2]: [userId, 'someone-else'] });
        vi.stubGlobal('fetch', fetch);
        expect(await deleteLinkedSessions(userId)).toBe(false);
        const deleted = fetch.mock.calls
            .filter(([, init]) => init?.method === 'DELETE')
            .map(([url]) => new URL(url).pathname.split('/').pop());
        expect(deleted).toEqual([s1]);
    });

    test('Umami linking more sessions than the search found fails the call', async () => {
        vi.stubGlobal('fetch', fakeUmami({ [s1]: [userId] }, { stitched: 3 }));
        expect(await deleteLinkedSessions(userId)).toBe(false);
    });

    test('a non-2xx list answer fails without deleting', async () => {
        const fetch = vi.fn(() => json({ error: 'nope' }, 401));
        vi.stubGlobal('fetch', fetch);
        expect(await deleteLinkedSessions(userId)).toBe(false);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('an answer that fails the schema fails without deleting', async () => {
        const fetch = vi.fn(() => json({ data: [{ id: 'not-a-uuid' }], count: 1 }));
        vi.stubGlobal('fetch', fetch);
        expect(await deleteLinkedSessions(userId)).toBe(false);
        expect(fetch.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(
            false,
        );
    });

    test('a failed delete fails the call; a 404 counts as gone', async () => {
        vi.stubGlobal('fetch', fakeUmami({ [s1]: [userId] }, { deleteStatus: 500 }));
        expect(await deleteLinkedSessions(userId)).toBe(false);
        vi.stubGlobal('fetch', fakeUmami({ [s1]: [userId] }, { deleteStatus: 404 }));
        expect(await deleteLinkedSessions(userId)).toBe(true);
    });

    test('a network error fails the call', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => Promise.reject(new Error('ECONNREFUSED'))),
        );
        expect(await deleteLinkedSessions(userId)).toBe(false);
    });
});
