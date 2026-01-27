/**
 * Animations Module
 */

window.Animations = {
    initLandingAnimations() {
        const overlay = document.getElementById('loading-overlay');
        if (!overlay) return;

        // Create 21 rockets
        for (let i = 0; i < 21; i++) {
            const rocket = document.createElement('div');
            rocket.className = 'rocket';
            rocket.innerText = '🚀';
            rocket.style.left = Math.random() * 90 + 5 + '%';
            const delay = i * 150 + Math.random() * 200;
            overlay.appendChild(rocket);

            setTimeout(() => {
                rocket.classList.add('launch');
            }, delay);
        }

        // Fade out overlay after 2 seconds
        setTimeout(() => {
            overlay.classList.add('fade-out');
        }, 2000);
    },

    resetAllScrolls() {
        window.scrollTo(0, 0);
        const viewCalc = document.getElementById("view-calculator");
        const mainPanel = document.getElementById("main-results-panel");
        const aside = document.querySelector("#view-calculator aside");

        if (viewCalc) viewCalc.scrollTop = 0;
        if (mainPanel) mainPanel.scrollTop = 0;
        if (aside) aside.scrollTop = 0;

        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
    }
};
