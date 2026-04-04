import { describe, test, expect } from 'vitest';
import { computeWorkerHealth } from '@/shared/utils/admin/computeWorkerHealth';

describe('computeWorkerHealth', () => {
    test('returns "down" when heartbeat is null (worker never started)', () => {
        const result = computeWorkerHealth(null);
        expect(result.status).toBe('down');
    });

    test('returns "healthy" when last_beat is recent and no error', () => {
        const heartbeat = {
            last_beat: new Date(Date.now() - 5000),
            last_error: null,
            started_at: new Date(Date.now() - 3600000),
            poll_duration_ms: 85,
        };
        const result = computeWorkerHealth(heartbeat);
        expect(result.status).toBe('healthy');
    });

    test('returns "degraded" when last_beat is recent but has error', () => {
        const heartbeat = {
            last_beat: new Date(Date.now() - 5000),
            last_error: 'Connection timeout',
            started_at: new Date(Date.now() - 3600000),
            poll_duration_ms: 85,
        };
        const result = computeWorkerHealth(heartbeat);
        expect(result.status).toBe('degraded');
    });

    test('returns "down" when last_beat is stale (>30s)', () => {
        const heartbeat = {
            last_beat: new Date(Date.now() - 45000),
            last_error: null,
            started_at: new Date(Date.now() - 3600000),
            poll_duration_ms: 85,
        };
        const result = computeWorkerHealth(heartbeat);
        expect(result.status).toBe('down');
    });

    test('returns "down" when last_beat is exactly 30s old (boundary)', () => {
        const heartbeat = {
            last_beat: new Date(Date.now() - 30001),
            last_error: null,
            started_at: new Date(Date.now() - 3600000),
            poll_duration_ms: 85,
        };
        const result = computeWorkerHealth(heartbeat);
        expect(result.status).toBe('down');
    });

    test('stale heartbeat with error still returns "down" not "degraded"', () => {
        const heartbeat = {
            last_beat: new Date(Date.now() - 45000),
            last_error: 'Some error',
            started_at: new Date(Date.now() - 3600000),
            poll_duration_ms: 85,
        };
        const result = computeWorkerHealth(heartbeat);
        expect(result.status).toBe('down');
    });

    test('returns correct color for each state', () => {
        expect(computeWorkerHealth(null).color).toBe('danger');

        const healthy = {
            last_beat: new Date(), last_error: null,
            started_at: new Date(), poll_duration_ms: 10,
        };
        expect(computeWorkerHealth(healthy).color).toBe('green-400');

        const degraded = {
            last_beat: new Date(), last_error: 'err',
            started_at: new Date(), poll_duration_ms: 10,
        };
        expect(computeWorkerHealth(degraded).color).toBe('yellow-400');
    });
});
