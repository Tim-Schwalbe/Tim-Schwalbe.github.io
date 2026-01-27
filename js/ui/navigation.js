/**
 * Navigation Module
 */

window.Navigation = {
    switchView(viewName) {
        ['calculator', 'info', 'satoshi'].forEach(v => {
            const el = document.getElementById('view-' + v);
            const nav = document.getElementById('nav-' + v);
            if (el) el.classList.add('hidden');
            if (nav) nav.classList.remove('active', 'text-gold-600');
        });

        const targetEl = document.getElementById('view-' + viewName);
        const targetNav = document.getElementById('nav-' + viewName);
        if (targetEl) targetEl.classList.remove('hidden');
        if (targetNav) targetNav.classList.add('active', 'text-gold-600');
    },

    smoothScrollToTop(element, duration = 300) {
        const start = element.scrollTop;
        if (start <= 0) return;
        const startTime = performance.now();

        function scroll(currentTime) {
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);

            element.scrollTop = start * (1 - ease);

            if (progress < 1) {
                requestAnimationFrame(scroll);
            } else {
                element.scrollTop = 0;
            }
        }
        requestAnimationFrame(scroll);
    }
};

// Global alias for inline onclick handlers
window.switchView = window.Navigation.switchView;
