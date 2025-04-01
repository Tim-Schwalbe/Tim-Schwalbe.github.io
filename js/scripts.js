// Hamburger-Menü Funktionalität
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('nav ul');

hamburger.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    hamburger.textContent = navMenu.classList.contains('active') ? '✕' : '☰'; // Symbol ändern
    adjustSectionPadding(); // Padding anpassen, wenn das Menü geöffnet/geschlossen wird
});

// Menü schließen, wenn ein Link geklickt wird
document.querySelectorAll('nav ul li a').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        hamburger.textContent = '☰'; // Symbol zurücksetzen
        adjustSectionPadding(); // Padding anpassen, nachdem das Menü geschlossen wurde
    });
});

// Debounce-Funktion, um das Scroll-Ereignis zu optimieren
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
};

// Menü schließen beim Scrollen auf Mobilgeräten
let lastScrollTop = 0;
const closeMenuOnScroll = debounce(() => {
    const isMobile = window.innerWidth <= 768;
    const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // Nur ausführen, wenn tatsächlich gescrollt wird
    if (isMobile && navMenu.classList.contains('active') && Math.abs(currentScrollTop - lastScrollTop) > 5) {
        navMenu.classList.remove('active');
        hamburger.textContent = '☰'; // Symbol zurücksetzen
        adjustSectionPadding(); // Padding anpassen, nachdem das Menü geschlossen wurde
    }
    lastScrollTop = currentScrollTop;
}, 50); // 50ms Verzögerung

window.addEventListener('scroll', closeMenuOnScroll);

// Funktion zum Anpassen des padding-top aller Sektionen basierend auf der Nav-Höhe
const adjustSectionPadding = () => {
    const navHeight = document.querySelector('nav').offsetHeight;
    const sections = document.querySelectorAll('section');
    const isMobile = window.innerWidth <= 768;
    const isMenuOpen = navMenu.classList.contains('active');
    
    // Berechne den padding-top basierend auf dem Zustand des Menüs
    const paddingTop = isMobile && !isMenuOpen ? navHeight : navHeight + (isMobile ? navMenu.offsetHeight : 0);
    
    // Speichere die aktuelle Scroll-Position
    const scrollPositionBefore = window.pageYOffset;
    
    // Passe den padding-top an
    sections.forEach(section => {
        section.style.paddingTop = `${paddingTop + 20}px`; // Nav-Höhe + zusätzlicher Abstand
    });

    // Berechne die neue Scroll-Position nach der Anpassung
    const scrollPositionAfter = window.pageYOffset;
    const scrollDifference = scrollPositionAfter - scrollPositionBefore;

    // Korrigiere die Scroll-Position, um ein Springen zu verhindern
    if (scrollDifference !== 0) {
        window.scrollTo({
            top: scrollPositionBefore,
            behavior: 'instant'
        });
    }
};

// Funktion zum Scrollen mit Offset
const scrollToSection = (targetElement) => {
    const navHeight = document.querySelector('nav').offsetHeight;
    const contentBox = targetElement.querySelector('.content');
    const targetPosition = contentBox.getBoundingClientRect().top + window.pageYOffset - navHeight - 10;
    window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
    });
};

// Beim Klicken auf Menüpunkte
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        scrollToSection(targetElement);
    });
});

// Beim Laden der Seite
window.addEventListener('load', () => {
    adjustSectionPadding();
    const hash = window.location.hash;
    if (hash) {
        const targetElement = document.querySelector(hash);
        if (targetElement) {
            scrollToSection(targetElement);
        }
    } else {
        const homeSection = document.querySelector('#home');
        scrollToSection(homeSection);
    }
});

// Bei Größenänderung des Fensters (z. B. Drehung des Geräts)
window.addEventListener('resize', () => {
    adjustSectionPadding();
});