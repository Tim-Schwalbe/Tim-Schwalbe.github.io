/**
 * Animations Module
 */

window.Animations = {
    initLandingAnimations() {
        const overlay = document.getElementById('loading-overlay');
        if (!overlay) return;

        // Create 21 rockets for initial load
        this._launchRockets(overlay, 21);

        setTimeout(() => {
            overlay.classList.add('fade-out');
        }, 2000);
    },

    _rocketInterval: null,

    _launchRockets(overlay, count) {
        for (let i = 0; i < count; i++) {
            const rocket = document.createElement('div');
            rocket.className = 'rocket';
            rocket.innerText = '🚀';
            rocket.style.left = Math.random() * 90 + 5 + '%';
            // Randomize size slightly
            const scale = 0.8 + Math.random() * 0.5;
            rocket.style.setProperty('--rocket-scale', scale);
            const delay = Math.random() * 1000;
            overlay.appendChild(rocket);

            setTimeout(() => {
                rocket.classList.add('launch');
                // Cleanup rocket element after animation
                setTimeout(() => rocket.remove(), 4000);
            }, delay);
        }
    },

    showLoadingOverlay(withRockets = false) {
        const overlay = document.getElementById('loading-overlay');
        const spinner = document.getElementById('loading-spinner');
        const text = document.getElementById('loading-text');
        const btc = document.getElementById('loading-btc-logo');
        if (!overlay) return;

        // Clear existing rockets and interval
        const existingRockets = overlay.querySelectorAll('.rocket');
        existingRockets.forEach(r => r.remove());
        if (this._rocketInterval) clearInterval(this._rocketInterval);

        overlay.classList.remove('fade-out');

        if (spinner) spinner.classList.remove('hidden');
        if (text) text.classList.remove('hidden');
        if (btc) btc.classList.add('spinning');

        if (withRockets) {
            // Initial burst
            this._launchRockets(overlay, 15);
            // Continuous rockets
            this._rocketInterval = setInterval(() => {
                this._launchRockets(overlay, 5);
            }, 800);
        }
    },

    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        const spinner = document.getElementById('loading-spinner');
        const text = document.getElementById('loading-text');
        const btc = document.getElementById('loading-btc-logo');
        if (!overlay) return;

        if (this._rocketInterval) {
            clearInterval(this._rocketInterval);
            this._rocketInterval = null;
        }

        overlay.classList.add('fade-out');

        // Hide spinner/text after fade out animation
        setTimeout(() => {
            if (spinner) spinner.classList.add('hidden');
            if (text) text.classList.add('hidden');
            if (btc) btc.classList.remove('spinning');
        }, 800);
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
