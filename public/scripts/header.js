let lastScrollTop = 0;
const header = document.getElementById('header');

window.addEventListener('scroll', function () {
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    // console.log(scrollTop);

    if (scrollTop < lastScrollTop) {
        // Scrolling up

        if (header.classList.contains('transition-top')) {
            header.style.top = `0px`;

            if (scrollTop < 100) {
                const percentage = (scrollTop * 10).toString();

                if (percentage.length === 2) {
                    const colorValue = '0' + percentage.toString();
                    header.style.backgroundColor = `rgba(0, 0, 0, 0.${colorValue})`;
                } else if (percentage.length === 1) {
                    const colorValue = '00' + percentage.toString();
                    header.style.backgroundColor = `rgba(0, 0, 0, 0.${colorValue})`;
                } else {
                    const colorValue = percentage.toString();
                    header.style.backgroundColor = `rgba(0, 0, 0, 0.${colorValue})`;
                }
            }
        } else {
            header.style.top = `-${scrollTop}px`;
        }
    } else {
        // Scrolling down
        if (scrollTop < 160) {
            header.classList.remove('transition-top');
            header.style.top = `-${scrollTop}px`;
            header.style.backgroundColor = `rgba(0, 0, 0, 0.00)`;
        } else {
            header.classList.add('transition-top');
            header.style.backgroundColor = `rgba(0, 0, 0, 1)`;
            header.style.top = `-160px`;
        }
    }

    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; // For Mobile or negative scrolling
});
