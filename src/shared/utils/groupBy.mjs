/**
 * `Map.groupBy`, minus the browser floor.
 *
 * The built-in landed in Chrome 117 / Firefox 119, well past this project's
 * declared support floor (Chrome 109 / Firefox 115 ESR — the last versions for
 * Windows 7/8). On anything older the call threw and took the whole timeline
 * with it (#495). `eslint-plugin-compat` does not flag it, so the ban lives in
 * `eslint.config.mjs` as a `no-restricted-syntax` rule instead.
 *
 * Same contract as the built-in: insertion-ordered `Map`, keys compared by
 * SameValueZero, values in encounter order.
 *
 * ponytail: four lines beats a core-js dependency every visitor downloads.
 * Delete this and inline `Map.groupBy` once the floor moves past Firefox 119.
 *
 * @template T, K
 * @param {Iterable<T>} items - Items to group
 * @param {(item: T, index: number) => K} keyFn - Derives each item's group key
 * @returns {Map<K, T[]>} Groups in first-seen key order
 */
export function groupBy(items, keyFn) {
    const groups = new Map();
    let index = 0;

    for (const item of items) {
        const key = keyFn(item, index++);
        const bucket = groups.get(key);
        if (bucket) bucket.push(item);
        else groups.set(key, [item]);
    }

    return groups;
}
