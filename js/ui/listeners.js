// REMOVED IMPORTS
// DEPENDENCIES: window.Handlers, window.Navigation, window.Tutorial

window.Listeners = {
    initListeners(runSimulationCallback) {
        // Currency Inputs
        const currencyIds = ['inp-initial', 'inp-buffer', 'inp-target-annual'];
        currencyIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', Handlers.handleCurrencyInput);
                if (id === 'inp-target-annual' || id === 'inp-initial') {
                    el.addEventListener('input', Handlers.updateFloorTooltips);
                    el.addEventListener('input', Handlers.updateCeilingTooltips);
                }
            }
        });

        // Floor Cut Input
        const inpFloorCut = document.getElementById('inp-floor-cut');
        if (inpFloorCut) inpFloorCut.addEventListener('input', Handlers.updateFloorTooltips);

        // Ceiling Input
        const inpCeilingEarly = document.getElementById('inp-ceiling-early');
        if (inpCeilingEarly) inpCeilingEarly.addEventListener('input', Handlers.updateCeilingTooltips);

        const inpCeilingLate = document.getElementById('inp-ceiling-late');
        if (inpCeilingLate) inpCeilingLate.addEventListener('input', Handlers.updateCeilingTooltips);

        // Allocation Sliders
        const allocIds = ['inp-alloc-crypto-pct', 'inp-alloc-stocks-pct', 'inp-alloc-bonds-pct'];
        allocIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    const source = id.replace('inp-alloc-', '').replace('-pct', '');
                    Handlers.updateAllocations(source);
                });
            }
        });

        // Advanced Toggle
        const btnAdvanced = document.getElementById('btn-advanced-toggle');
        if (btnAdvanced) btnAdvanced.addEventListener('click', Handlers.toggleAdvanced);

        // Crash Config Toggle
        const chkForceCrash = document.getElementById('chk-force-start-crash');
        if (chkForceCrash) {
            chkForceCrash.addEventListener('change', (e) => {
                document.getElementById('div-crash-config').classList.toggle('hidden', !e.target.checked);
            });
        }

        // Run Button
        const btnRun = document.getElementById('btn-run');
        if (btnRun) btnRun.addEventListener('click', runSimulationCallback);

        // Navigation
        const navItems = ['calculator', 'info', 'satoshi'];
        navItems.forEach(item => {
            const nav = document.getElementById('nav-' + item);
            if (nav) nav.addEventListener('click', () => Navigation.switchView(item));
        });

        // Tutorial
        const btnTour = document.getElementById('btn-start-tour');
        if (btnTour) btnTour.addEventListener('click', Tutorial.startTutorial);
    }
};
