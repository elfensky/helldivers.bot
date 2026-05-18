import { EVENT_TYPE, EVENT_STATUS, CAMPAIGN_STATUS } from '@/shared/enums/events.mjs';

describe('events enums', () => {
    describe('EVENT_TYPE', () => {
        test('has DEFEND and ATTACK keys', () => {
            expect(EVENT_TYPE.DEFEND).toBe('defend');
            expect(EVENT_TYPE.ATTACK).toBe('attack');
        });

        test('has exactly 2 keys', () => {
            expect(Object.keys(EVENT_TYPE)).toHaveLength(2);
        });
    });

    describe('EVENT_STATUS', () => {
        test('has ACTIVE, SUCCESS, and FAIL keys', () => {
            expect(EVENT_STATUS.ACTIVE).toBe('active');
            expect(EVENT_STATUS.SUCCESS).toBe('success');
            expect(EVENT_STATUS.FAIL).toBe('fail');
        });

        test('has exactly 3 keys', () => {
            expect(Object.keys(EVENT_STATUS)).toHaveLength(3);
        });
    });

    describe('CAMPAIGN_STATUS', () => {
        test('has ACTIVE, DEFEATED, and HIDDEN keys', () => {
            expect(CAMPAIGN_STATUS.ACTIVE).toBe('active');
            expect(CAMPAIGN_STATUS.DEFEATED).toBe('defeated');
            expect(CAMPAIGN_STATUS.HIDDEN).toBe('hidden');
        });

        test('has exactly 3 keys', () => {
            expect(Object.keys(CAMPAIGN_STATUS)).toHaveLength(3);
        });
    });
});
