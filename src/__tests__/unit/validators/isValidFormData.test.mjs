import { isValidFormData, schemaNumber } from '@/validators/isValidFormData.js';

describe('schemaNumber', () => {
    test('accepts positive integers and coerces strings', () => {
        expect(schemaNumber.safeParse(1).success).toBe(true);
        expect(schemaNumber.safeParse('7').success).toBe(true);
        expect(schemaNumber.safeParse('7').data).toBe(7);
    });

    test('rejects invalid values', () => {
        expect(schemaNumber.safeParse(0).success).toBe(false);
        expect(schemaNumber.safeParse(-1).success).toBe(false);
        expect(schemaNumber.safeParse(1.5).success).toBe(false);
        expect(schemaNumber.safeParse('abc').success).toBe(false);
    });
});

describe('isValidFormData', () => {
    describe('get_campaign_status', () => {
        test('accepts valid action-only object', () => {
            const result = isValidFormData.safeParse({ action: 'get_campaign_status' });
            expect(result.success).toBe(true);
        });

        test('strips extra keys (Zod default behavior)', () => {
            const result = isValidFormData.safeParse({
                action: 'get_campaign_status',
                extra: 'field',
            });
            expect(result.success).toBe(true);
            expect(result.data).not.toHaveProperty('extra');
        });
    });

    describe('get_snapshots', () => {
        test('accepts valid action with season', () => {
            const result = isValidFormData.safeParse({
                action: 'get_snapshots',
                season: 1,
            });
            expect(result.success).toBe(true);
        });

        test('coerces string season', () => {
            const result = isValidFormData.safeParse({
                action: 'get_snapshots',
                season: '3',
            });
            expect(result.success).toBe(true);
        });

        test('rejects missing season', () => {
            const result = isValidFormData.safeParse({ action: 'get_snapshots' });
            expect(result.success).toBe(false);
        });
    });

    describe('get_available_entitlements', () => {
        test('accepts valid action-only object', () => {
            const result = isValidFormData.safeParse({
                action: 'get_available_entitlements',
            });
            expect(result.success).toBe(true);
        });

        test('strips extra keys (Zod default behavior)', () => {
            const result = isValidFormData.safeParse({
                action: 'get_available_entitlements',
                foo: 'bar',
            });
            expect(result.success).toBe(true);
            expect(result.data).not.toHaveProperty('foo');
        });
    });

    describe('get_leaderboards', () => {
        test('accepts valid required fields', () => {
            const result = isValidFormData.safeParse({
                action: 'get_leaderboards',
                network: 'steam',
                season: 1,
            });
            expect(result.success).toBe(true);
        });

        test('accepts optional count and users', () => {
            const result = isValidFormData.safeParse({
                action: 'get_leaderboards',
                network: 'psn',
                season: 2,
                count: 10,
                users: ['76561198000000000'],
            });
            expect(result.success).toBe(true);
        });

        test('rejects invalid network value', () => {
            const result = isValidFormData.safeParse({
                action: 'get_leaderboards',
                network: 'xbox',
                season: 1,
            });
            expect(result.success).toBe(false);
        });

        test('rejects missing network', () => {
            const result = isValidFormData.safeParse({
                action: 'get_leaderboards',
                season: 1,
            });
            expect(result.success).toBe(false);
        });

        test('rejects missing season', () => {
            const result = isValidFormData.safeParse({
                action: 'get_leaderboards',
                network: 'steam',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('get_usernames', () => {
        test('accepts valid fields', () => {
            const result = isValidFormData.safeParse({
                action: 'get_usernames',
                network: 'steam',
                count: 5,
            });
            expect(result.success).toBe(true);
        });

        test('coerces string count', () => {
            const result = isValidFormData.safeParse({
                action: 'get_usernames',
                network: 'psn',
                count: '10',
            });
            expect(result.success).toBe(true);
        });

        test('rejects missing count', () => {
            const result = isValidFormData.safeParse({
                action: 'get_usernames',
                network: 'steam',
            });
            expect(result.success).toBe(false);
        });

        test('rejects invalid network', () => {
            const result = isValidFormData.safeParse({
                action: 'get_usernames',
                network: 'origin',
                count: 1,
            });
            expect(result.success).toBe(false);
        });
    });

    describe('edge cases', () => {
        test('rejects unknown action', () => {
            const result = isValidFormData.safeParse({ action: 'unknown_action' });
            expect(result.success).toBe(false);
        });

        test('rejects missing action', () => {
            const result = isValidFormData.safeParse({ season: 1 });
            expect(result.success).toBe(false);
        });

        test('rejects empty object', () => {
            expect(isValidFormData.safeParse({}).success).toBe(false);
        });

        test('rejects null and undefined', () => {
            expect(isValidFormData.safeParse(null).success).toBe(false);
            expect(isValidFormData.safeParse(undefined).success).toBe(false);
        });

        test('rejects non-object types', () => {
            expect(isValidFormData.safeParse('string').success).toBe(false);
            expect(isValidFormData.safeParse(42).success).toBe(false);
        });
    });
});
