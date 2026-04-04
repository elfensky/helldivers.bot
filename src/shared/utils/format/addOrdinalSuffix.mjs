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
