// Scroll-hide header — only active at md: (768px+) where BottomNav is hidden.
// Header tracks scroll delta 1:1 so it feels like it's parked just above the viewport.
// Uses requestAnimationFrame for smooth, non-blocking updates.
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
