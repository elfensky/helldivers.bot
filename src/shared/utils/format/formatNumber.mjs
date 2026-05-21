/**
 * Formats a number for compact display (1.2B, 3.4M, or locale-grouped).
 * Returns '—' for null, undefined, or non-finite values.
 * @param {number|string|null|undefined} n - The value to format
 * @returns {string}
 */
export function formatNumber(n) {
    if (n === undefined || n === null) return '—';
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
    // M suffix from 1M up — a 7-digit grouped number ("3,522,088") overflows
    // the stat cards, so anything >= 1M collapses to "X.XM".
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return num.toLocaleString();
    return String(num);
}
