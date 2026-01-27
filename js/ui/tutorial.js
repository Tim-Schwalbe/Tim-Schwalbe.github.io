// REMOVED IMPORT: switchView from ./navigation.js
// DEPENDENCIES: window.Navigation

const tutorialSteps = [
    { id: 'inp-years', title: 'Time Horizon', text: 'How long do you want to plan for?' },
    { id: 'inp-initial', title: 'Invested Capital', text: 'Your current starting portfolio value.' },
    { id: 'inp-buffer', title: 'Cash Buffer', text: 'Cash set aside for emergencies.' },
    { id: 'inp-alloc-crypto-pct', title: 'Asset Allocation', text: 'Balance between Crypto and Stocks.' },
    { id: 'btn-run', title: 'Run Simulation', text: 'Starts the JS Monte Carlo engine.' }
];

let currentStepIndex = -1;

window.Tutorial = {
    startTutorial() {
        Navigation.switchView('calculator');
        currentStepIndex = 0;
        const ov = document.getElementById('tutorial-overlay');
        ov.classList.remove('hidden', 'pointer-events-none');
        showTutorialStep();
    },

    endTutorial() {
        currentStepIndex = -1;
        const ov = document.getElementById('tutorial-overlay');
        ov.classList.add('hidden', 'pointer-events-none');
        ov.innerHTML = '';
    }
};

// Global alias for inline onclick handlers
window.startTutorial = window.Tutorial.startTutorial;

function showTutorialStep() {
    const step = tutorialSteps[currentStepIndex];
    const el = document.getElementById(step.targetOverride || step.id);
    if (!el) { window.Tutorial.endTutorial(); return; }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const rect = el.getBoundingClientRect();

    const top = rect.bottom + window.scrollY + 12;
    const left = rect.left + window.scrollX;

    const tooltipHtml = `
    <div class="tutorial-tooltip tooltip-bottom" style="top: ${top}px; left: ${left}px;">
        <div class="flex justify-between items-start mb-2 border-b border-white/20 pb-2">
            <h4 class="font-bold text-white text-sm">${step.title}</h4>
        </div>
        <p class="text-sm text-white/90 mb-4">${step.text}</p>
        <div class="flex gap-2">
            <button id="tutorial-skip" class="text-xs text-white/60 hover:text-white">Skip</button>
            <button id="tutorial-next" class="bg-white/20 text-white text-xs font-bold px-4 py-1.5 rounded">Next</button>
        </div>
    </div>`;

    const overlay = document.getElementById('tutorial-overlay');
    overlay.innerHTML = tooltipHtml;

    document.getElementById('tutorial-skip').onclick = window.Tutorial.endTutorial;
    document.getElementById('tutorial-next').onclick = nextStep;
}

function nextStep() {
    currentStepIndex++;
    if (currentStepIndex >= tutorialSteps.length) window.Tutorial.endTutorial();
    else showTutorialStep();
}
