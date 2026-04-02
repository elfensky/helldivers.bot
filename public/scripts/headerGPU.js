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

    function updateHeader(scrollTop) {
        var delta = scrollTop - lastScrollTop;

        // Shift offset by scroll delta, clamped to [-headerHeight, 0]
        offset = Math.min(0, Math.max(-headerHeight, offset - delta));

        header.style.top = offset + 'px';

        // Glass effect: fade out smoothly as we approach the top
        var fadeEnd = headerHeight;           // glass fully gone at 80px
        var fadeStart = headerHeight * 3;     // glass starts fading at 240px

        if (scrollTop <= fadeEnd) {
            // In the top zone — fully transparent, no glass
            header.style.backgroundColor = 'rgba(19, 19, 19, 0)';
            header.classList.remove('header-glass');
        } else if (scrollTop < fadeStart && delta < 0) {
            // Fade zone — scrolling up, blend glass opacity proportionally
            var t = (scrollTop - fadeEnd) / (fadeStart - fadeEnd); // 0 at fadeEnd, 1 at fadeStart
            var opacity = t * 0.85;
            header.style.backgroundColor = 'rgba(19, 19, 19, ' + opacity.toFixed(3) + ')';
            header.classList.add('header-glass');
        } else if (delta < 0) {
            // Scrolling up mid-page — full glass
            header.style.backgroundColor = 'rgba(19, 19, 19, 0.85)';
            header.classList.add('header-glass');
        } else if (offset <= -headerHeight) {
            // Fully hidden — clear for clean next reveal
            header.style.backgroundColor = 'rgba(19, 19, 19, 0)';
            header.classList.remove('header-glass');
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
        offset = 0;
        lastScrollTop = 0;
        ticking = false;
    }

    function handleBreakpoint(e) {
        if (e.matches) {
            active = true;
            lastScrollTop = Math.max(0, window.pageYOffset || document.documentElement.scrollTop);
            offset = 0;
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
