export function formatNumber(num) {
    if (typeof num === 'bigint') {
        num = Number(num); // Convert BigInt to Number for formatting (may lose precision for very large numbers)
    }

    if (num >= 1_000_000) {
        return Math.round(num / 1_000_000) + 'M';
    } else if (num >= 1_000) {
        return Math.round(num / 1_000) + 'K';
    } else {
        return num.toString();
    }
}

export function addOrdinalSuffix(num) {
    const j = num % 10,
        k = num % 100;

    if (k >= 11 && k <= 13) {
        return num + 'th';
    }

    switch (j) {
        case 1:
            return num + 'st';
        case 2:
            return num + 'nd';
        case 3:
            return num + 'rd';
        default:
            return num + 'th';
    }
}
