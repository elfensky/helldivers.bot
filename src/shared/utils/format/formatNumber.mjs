/**
 * Formats a number for compact display (1.2B, 3.4M, or locale-grouped).
 * Returns '—' for null, undefined, or non-finite values.
 * @param {number|string|null|undefined} n
 * @returns {string}
 */
export function formatNumber(n) {
    if (n === undefined || n === null) return '—';
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
    if (num >= 10_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return num.toLocaleString();
    return String(num);
}
