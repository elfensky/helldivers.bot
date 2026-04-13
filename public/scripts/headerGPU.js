// Scroll-hide header + CSS-var publisher for downstream consumers.
//
// Active at md: (768px+) where BottomNav is hidden. The header tracks
// scroll delta 1:1 so it feels like it's parked just above the viewport,
// showing when you scroll up and hiding when you scroll down. All
// updates are scheduled via requestAnimationFrame for smooth,
// non-blocking rendering.
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
//
//   `--header-bg`: current `background-color` (an `rgba(19, 19, 19, N)`
//     string). Zero alpha at the top of the page, interpolated when
//     scroll-revealed, `0.85` mid-page. Consumed by the pinned map
//     at md+ (`@media (min-width: 768px) { .home-map--sticky }`) as
//     `background: var(--header-bg, transparent)` so the map's tint
//     mirrors the header's at every scroll state.
//
//   `--header-glass-filter`: `blur(8.8px)` or `none`, matching
//     whether the `.header-glass` class is active on the `<header>`.
//     Consumed by the `useHeaderGlassFilter` React hook
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

    // Apply the header's backgroundColor + glass state, and mirror both
    // onto <html> as CSS vars so the pinned map (which mirrors the
    // header on tablet+) can track them via var() lookups. See the
    // @media (min-width: 768px) rules on `.home-map--sticky` and
    // `.archives-map-col--sticky`.
    function setHeaderBg(color, glass) {
        header.style.backgroundColor = color;
        document.documentElement.style.setProperty('--header-bg', color);
        if (glass) {
            header.classList.add('header-glass');
            document.documentElement.style.setProperty(
                '--header-glass-filter',
                'blur(8.8px)',
            );
        } else {
            header.classList.remove('header-glass');
            document.documentElement.style.setProperty('--header-glass-filter', 'none');
        }
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

        // Glass effect: fade out smoothly as we approach the top
        var fadeEnd = headerHeight; // glass fully gone at 80px
        var fadeStart = headerHeight * 3; // glass starts fading at 240px

        if (scrollTop <= fadeEnd) {
            // In the top zone — fully transparent, no glass
            setHeaderBg('rgba(19, 19, 19, 0)', false);
        } else if (scrollTop < fadeStart && delta < 0) {
            // Fade zone — scrolling up, blend glass opacity proportionally
            var t = (scrollTop - fadeEnd) / (fadeStart - fadeEnd); // 0 at fadeEnd, 1 at fadeStart
            var opacity = t * 0.85;
            setHeaderBg('rgba(19, 19, 19, ' + opacity.toFixed(3) + ')', true);
        } else if (delta < 0) {
            // Scrolling up mid-page — full glass
            setHeaderBg('rgba(19, 19, 19, 0.85)', true);
        } else if (offset <= -headerHeight) {
            // Fully hidden — clear for clean next reveal
            setHeaderBg('rgba(19, 19, 19, 0)', false);
        }

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
            lastScrollTop = Math.max(
                0,
                window.pageYOffset || document.documentElement.scrollTop,
            );
            offset = 0;
            // Initialize the CSS vars so the map's transform is 0 and
            // background tracks the header's initial transparent state
            // on mount before the first scroll event fires.
            document.documentElement.style.setProperty('--header-offset', '0px');
            document.documentElement.style.setProperty(
                '--header-bg',
                'rgba(19, 19, 19, 0)',
            );
            document.documentElement.style.setProperty('--header-glass-filter', 'none');
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
