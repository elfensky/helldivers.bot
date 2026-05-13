export const SORT_ORDER_KEY = 'event-log-sort';
export const SORT_ORDER_DEFAULT = 'desc';

export function validateSortOrder(value) {
    return value === 'asc' || value === 'desc' ? value : SORT_ORDER_DEFAULT;
}
