// Scroll-hide header + CSS-var publisher for downstream consumers.
//
// Active at md: (768px+) where BottomNav is hidden. The header tracks
// scroll delta 1:1 so it feels like it's parked just above the viewport,
// showing when you scroll up and hiding when you scroll down. All
// updates are scheduled via requestAnimationFrame for smooth,
// non-blocking rendering.
//
// ## Two decoupled output paths
//
// The script has two consumers with different needs:
//
// 1. The `<header>` DOM element itself. Its `backgroundColor` and
//    `.header-glass` class ARE direction-aware — that's what makes the
//    scroll-hide/reveal animation feel responsive. Handled by the
//    `setHeaderElementBg(color, glass)` helper and the direction-aware
//    branches inside `updateHeader()`.
//
// 2. The pinned map on `/` and `/archives` at md+. It mirrors the
//    header's visual tint via the `--header-bg` / `--header-glass-filter`
//    CSS vars, but the map is always on-screen when pinned — so its
//    backdrop should NOT flicker when the user scrolls down or when the
//    header slides off-screen. Handled by `publishMapBackdrop(scrollTop)`
//    which is direction-agnostic: backdrop opacity is a pure function
//    of scroll position (see the fade curve below).
//
// Historically both jobs were funneled through one `setHeaderBg` that
// also wrote the CSS vars, which meant the map inherited the header's
// direction-aware logic and went transparent on scroll-down. Splitting
// them fixes that without touching the header element's feel.
//
// ## CSS custom properties (published to <html>)
//
// The script publishes three CSS custom properties so layout code can
// react without coupling to imperative JS. All three are removed in
// `resetHeader()` when the breakpoint drops below md, so consumers
// using `var(--name, fallback)` get clean defaults outside the active
// range.
//
//   `--header-offset`: current vertical offset (`0px` → `-80px`).
//     Zero when the header is fully visible, `-80px` when fully
//     scroll-hidden. Consumed by `.home-map--sticky` /
//     `.archives-map-col--sticky` as `transform: translateY(var(...))`
//     so pinned-map elements track the header pixel-for-pixel.
//     Direction-aware (matches the header element).
//
//   `--header-bg`: map backdrop color as an `rgba(19, 19, 19, N)`
//     string. **Direction-agnostic** — depends only on `scrollTop`:
//     0 alpha in the top zone (≤80px), linearly interpolated from
//     0→0.85 through the fade zone (80–240px), full `0.85` past 240px.
//     Consumed by the pinned map at md+
//     (`@media (min-width: 768px) { .home-map--sticky }`) as
//     `background: var(--header-bg, transparent)`. Persists whether
//     the user is scrolling up or down, and whether the header element
//     is visible or hidden — so the map never flickers transparent
//     mid-page.
//
//   `--header-glass-filter`: `blur(8.8px)` when `--header-bg` alpha
//     is > 0, else `none`. **Direction-agnostic** — mirrors the same
//     scroll-position gate as `--header-bg`. Consumed by the
//     `useHeaderGlassFilter` React hook
//     (`src/shared/hooks/useHeaderGlassFilter.mjs`), which applies
//     it as an inline `style={{ backdropFilter }}` on the pinned map
//     element. Inline style is required because Lightning CSS
//     (Turbopack's CSS optimizer) strips `backdrop-filter`
//     declarations that reference custom properties from built CSS
//     — see `CHANGELOG.md#0.39.7` and `#0.39.14`.
//
// Mobile (<md) consumers automatically fall back to their var
// defaults because `resetHeader()` runs on the breakpoint change.
(function () {
    var header = document.getElementById('header');
    if (!header) return;

    var headerHeight = 80; // sm:h-[80px] — header height at md+ breakpoint
    var lastScrollTop = 0;
    var offset = 0; // current header offset: 0 = fully visible, -headerHeight = fully hidden
    var ticking = false;
    var active = false;
    var mql = window.matchMedia('(min-width: 768px)');

    // Mutate the <header> element's own backgroundColor + glass class.
    // This path IS direction-aware — the header hides on scroll-down
    // and reveals on scroll-up, and its own tint tracks that visual.
    // Does NOT write the CSS vars (those are `publishMapBackdrop`'s job).
    function setHeaderElementBg(color, glass) {
        header.style.backgroundColor = color;
        if (glass) {
            header.classList.add('header-glass');
        } else {
            header.classList.remove('header-glass');
        }
    }

    // Publish the map backdrop CSS vars. Direction-agnostic: opacity
    // depends only on `scrollTop`, using the same fade curve the header
    // element uses on its scroll-up path. This keeps the pinned map's
    // backdrop stable whether the user is scrolling up or down, and
    // whether the header element is currently on- or off-screen.
    //
    //   scrollTop ≤ 80  → 0 (top zone, transparent)
    //   80 < scrollTop < 240 → linear fade 0 → 0.85
    //   scrollTop ≥ 240 → 0.85 (full glass)
    function publishMapBackdrop(scrollTop) {
        var topZoneEnd = headerHeight; // 80
        var fullGlassStart = headerHeight * 3; // 240
        var opacity;
        if (scrollTop <= topZoneEnd) {
            opacity = 0;
        } else if (scrollTop >= fullGlassStart) {
            opacity = 0.85;
        } else {
            opacity = ((scrollTop - topZoneEnd) / (fullGlassStart - topZoneEnd)) * 0.85;
        }
        document.documentElement.style.setProperty(
            '--header-bg',
            'rgba(19, 19, 19, ' + opacity.toFixed(3) + ')',
        );
        document.documentElement.style.setProperty(
            '--header-glass-filter',
            opacity > 0 ? 'blur(8.8px)' : 'none',
        );
    }

    function updateHeader(scrollTop) {
        var delta = scrollTop - lastScrollTop;

        // Shift offset by scroll delta, clamped to [-headerHeight, 0]
        offset = Math.min(0, Math.max(-headerHeight, offset - delta));

        header.style.top = offset + 'px';
        // Expose to CSS so sticky-positioned elements (pinned map on tablet,
        // desktop grid map) can translate in sync with the header. Read via
        // `transform: translateY(var(--header-offset, 0px))` in the map's
        // sticky rules — see HomeClient.css / ArchivesLayout.css.
        document.documentElement.style.setProperty('--header-offset', offset + 'px');

        // --- Header element: direction-aware background + glass class ---
        // Controls how the <header> itself paints as it hides/reveals.
        // Does NOT affect the map (see publishMapBackdrop below).
        var fadeEnd = headerHeight; // glass fully gone at 80px
        var fadeStart = headerHeight * 3; // glass starts fading at 240px

        if (scrollTop <= fadeEnd) {
            // In the top zone — fully transparent, no glass
            setHeaderElementBg('rgba(19, 19, 19, 0)', false);
        } else if (scrollTop < fadeStart && delta < 0) {
            // Fade zone — scrolling up, blend glass opacity proportionally
            var t = (scrollTop - fadeEnd) / (fadeStart - fadeEnd); // 0 at fadeEnd, 1 at fadeStart
            var opacity = t * 0.85;
            setHeaderElementBg('rgba(19, 19, 19, ' + opacity.toFixed(3) + ')', true);
        } else if (delta < 0) {
            // Scrolling up mid-page — full glass
            setHeaderElementBg('rgba(19, 19, 19, 0.85)', true);
        } else if (offset <= -headerHeight) {
            // Fully hidden — clear for clean next reveal
            setHeaderElementBg('rgba(19, 19, 19, 0)', false);
        }

        // --- Map backdrop: direction-agnostic ---
        // Published every tick so the pinned map's tint follows scroll
        // position smoothly regardless of direction or header visibility.
        publishMapBackdrop(scrollTop);

        lastScrollTop = Math.max(0, scrollTop);
        ticking = false;
    }

    function onScroll() {
        if (!active) return;
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (!ticking) {
            requestAnimationFrame(function () {
                updateHeader(scrollTop);
            });
            ticking = true;
        }
    }

    function resetHeader() {
        header.style.top = '';
        header.style.backgroundColor = '';
        header.classList.remove('header-glass');
        // Drop the CSS vars so map sticky rules fall back to their
        // default values (translate 0, transparent bg, no blur) when
        // we leave the md+ breakpoint.
        document.documentElement.style.removeProperty('--header-offset');
        document.documentElement.style.removeProperty('--header-bg');
        document.documentElement.style.removeProperty('--header-glass-filter');
        offset = 0;
        lastScrollTop = 0;
        ticking = false;
    }

    function handleBreakpoint(e) {
        if (e.matches) {
            active = true;
            var scrollTop = Math.max(
                0,
                window.pageYOffset || document.documentElement.scrollTop,
            );
            lastScrollTop = scrollTop;
            offset = 0;
            // Initialize --header-offset for the map's transform.
            document.documentElement.style.setProperty('--header-offset', '0px');
            // Initialize map backdrop vars from the CURRENT scroll position
            // so the map paints correctly on mount even when the user loads
            // the page already scrolled mid-page. publishMapBackdrop writes
            // both --header-bg and --header-glass-filter.
            publishMapBackdrop(scrollTop);
        } else {
            active = false;
            resetHeader();
        }
    }

    // Initial check + listen for viewport changes
    handleBreakpoint(mql);
    mql.addEventListener('change', handleBreakpoint);
    window.addEventListener('scroll', onScroll, { passive: true });
})();
