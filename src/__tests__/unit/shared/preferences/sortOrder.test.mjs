import { describe, test, expect } from 'vitest';
import {
    SORT_ORDER_DEFAULT,
    CASCADE_SORT_ORDER_DEFAULT,
    validateSortOrder,
    validateCascadeSortOrder,
} from '@/shared/preferences/sortOrder.mjs';

describe('validateSortOrder', () => {
    test('passes through the two valid values', () => {
        expect(validateSortOrder('asc')).toBe('asc');
        expect(validateSortOrder('desc')).toBe('desc');
    });

    test('falls back to the default for invalid / missing input', () => {
        expect(SORT_ORDER_DEFAULT).toBe('desc');
        expect(validateSortOrder('worst')).toBe(SORT_ORDER_DEFAULT);
        expect(validateSortOrder('')).toBe(SORT_ORDER_DEFAULT);
        expect(validateSortOrder(undefined)).toBe(SORT_ORDER_DEFAULT);
        expect(validateSortOrder(null)).toBe(SORT_ORDER_DEFAULT);
    });
});

describe('validateCascadeSortOrder', () => {
    test('passes through the two valid values', () => {
        expect(validateCascadeSortOrder('worst')).toBe('worst');
        expect(validateCascadeSortOrder('recent')).toBe('recent');
    });

    test('falls back to the default for invalid / missing input', () => {
        expect(CASCADE_SORT_ORDER_DEFAULT).toBe('worst');
        expect(validateCascadeSortOrder('asc')).toBe(CASCADE_SORT_ORDER_DEFAULT);
        expect(validateCascadeSortOrder('')).toBe(CASCADE_SORT_ORDER_DEFAULT);
        expect(validateCascadeSortOrder(undefined)).toBe(CASCADE_SORT_ORDER_DEFAULT);
        expect(validateCascadeSortOrder(null)).toBe(CASCADE_SORT_ORDER_DEFAULT);
    });
});
