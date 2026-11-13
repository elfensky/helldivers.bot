/**
 * Ends the current document with one full navigation to the same address, after
 * a consent change that stops replay or starts or stops identify(). A running
 * recorder cannot be stopped (analytics-standard trap 19), and router.refresh()
 * keeps the document, so replay and identity could share a page load (trap 22).
 * It runs once per click and cannot loop, so it is not a stale-version reload
 * and does not use guardedReload(), which can decline.
 */
export function reloadDocument() {
    window.location.assign(window.location.href);
}
