//scrollbehavior
const header = document.getElementById('header');
let lastScrollTop = 0;
let ticking = false;

function getColorValue(scrollTop) {
    const percentage = (scrollTop * 10).toString().padStart(3, '0');
    return `rgba(1, 47, 57, 0.${percentage})`;
}

function updateHeader(scrollTop) {
    if (scrollTop < lastScrollTop) {
        // Scrolling up
        if (header.classList.contains('header-transition')) {
            header.style.top = `0px`;

            if (scrollTop < 100) {
                header.style.backgroundColor = getColorValue(scrollTop);
            }
        } else {
            header.style.top = `-${scrollTop}px`;
        }
    } else {
        // Scrolling down
        if (scrollTop < 160) {
            header.classList.remove('header-transition');
            header.style.top = `-${scrollTop}px`;
            header.style.backgroundColor = `rgba(1, 47, 57, 0.00)`;
        } else {
            header.classList.add('header-transition');
            header.style.backgroundColor = `rgba(1, 47, 57, 0.5)`;
            header.style.top = `-160px`;
        }
    }

    lastScrollTop = Math.max(0, scrollTop);
    ticking = false;
}

window.addEventListener('scroll', function () {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (!ticking) {
        requestAnimationFrame(() => updateHeader(scrollTop));
        ticking = true;
    }
});
