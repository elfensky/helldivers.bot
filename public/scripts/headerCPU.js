//scrollbehavior
const header = document.getElementById('header');
const header_opacity = 0.7;
let lastScrollTop = 0;

function getColorValue(scrollTop) {
    const percentage_scroll = (scrollTop * 10).toString().padStart(3, '0');
    console.log(percentage_scroll);
    const percentage = (header_opacity / 100) * percentage_scroll;
    return `rgba(1, 47, 57, 0.${percentage})`;
}

window.addEventListener('scroll', function () {
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;

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
            header.style.backgroundColor = `rgba(1, 47, 57, ${header_opacity})`;
            header.style.top = `-160px`;
        }
    }

    lastScrollTop = Math.max(0, scrollTop); // For Mobile or negative scrolling
});
