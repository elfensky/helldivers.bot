/**
 * Formats a numerator/denominator pair as a one-decimal ratio (e.g. "24.0").
 * Returns '—' when the denominator is zero, null, or undefined.
 * Both arguments are coerced with Number(), so BigInt values are accepted.
 * @param {number|bigint|string|null|undefined} numerator - The dividend
 * @param {number|bigint|string|null|undefined} denominator - The divisor
 * @returns {string}
 */
export function formatRatio(numerator, denominator) {
    if (!denominator) return '—';
    return (Number(numerator) / Number(denominator)).toFixed(1);
}
