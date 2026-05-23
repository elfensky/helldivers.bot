export const SORT_ORDER_KEY = 'event-log-sort';
export const SORT_ORDER_DEFAULT = 'desc';

export function validateSortOrder(value) {
    return value === 'asc' || value === 'desc' ? value : SORT_ORDER_DEFAULT;
}

export const CASCADE_SORT_ORDER_KEY = 'cascade-log-sort';
export const CASCADE_SORT_ORDER_DEFAULT = 'worst';

export function validateCascadeSortOrder(value) {
    return value === 'worst' || value === 'recent' ? value : CASCADE_SORT_ORDER_DEFAULT;
}
