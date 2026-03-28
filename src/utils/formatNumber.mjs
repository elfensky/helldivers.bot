export function formatNumber(n) {
    if (n === undefined || n === null) return '—';
    const num = Number(n);
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return num.toLocaleString();
    return String(num);
}
