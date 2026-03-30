//mobile
const menu = document.getElementById('menu');
const navigation = document.getElementById('navigation');

// console.log(menu, navigation);

menu.addEventListener('click', function () {
    // navigation.classList.toggle('opacity-0');

    //OPACITY
    // navigation.classList.toggle('opacity-100');
    navigation.classList.toggle('pointer-events-none');
    if (navigation.style.top === '100%') {
        navigation.style.top = '-400%';
    } else {
        navigation.style.top = '100%';
    }

    //ASD
});

window.addEventListener('resize', function () {
    // console.log(window.innerWidth);

    if (window.innerWidth <= 768) {
        navigation.classList.remove('opacity-100');
        navigation.classList.add('pointer-events-none');
        navigation.style.top = '-400%';
    } else {
        navigation.classList.remove('pointer-events-none');
    }
});
