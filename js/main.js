// REMOVED IMPORTS: Dependencies are now global.
// DEPENDENCIES: Config, Animations, Listeners, Handlers, generateMarketData, simulatePortfolio, findSWR, Renderer, Formatters

document.addEventListener('DOMContentLoaded', () => {
    // 1. Init Animations & Scroll
    Animations.resetAllScrolls();
    Animations.initLandingAnimations();

    // 2. Init Listeners
    Listeners.initListeners(runSimulation);

    // 3. Enable the Run button (no auto-run to avoid null reference errors)
    const runBtn = document.getElementById('btn-run');
    if (runBtn) runBtn.disabled = false;
});

async function runSimulation() {
    console.log("🚀 Starting Simulation...");

    // 1. Gather Configs
    const configs = {
        years: parseInt(document.getElementById('inp-years').value) || 30,
        INVESTED_AMOUNT: Formatters.parseFormattedValue(document.getElementById('inp-initial').value),
        CASH_BUFFER: Formatters.parseFormattedValue(document.getElementById('inp-buffer').value),
        TARGET_ANNUAL_EXP: Formatters.parseFormattedValue(document.getElementById('inp-target-annual').value),
        ALLOC_CRYPTO: (parseInt(document.getElementById('inp-alloc-crypto-pct').value) || 0) / 100,
        ALLOC_STOCKS: (parseInt(document.getElementById('inp-alloc-stocks-pct').value) || 0) / 100,
        TARGET_SUCCESS_PERCENT: parseFloat(document.getElementById('inp-target-success').value) || 95,

        // Advanced
        numSims: parseInt(document.getElementById('inp-num-sims').value) || 1000,
        ...Config.getConfig(window, 'DEFAULT_CONFIGS', {}) // Fallback
    };

    // Advanced Configs override
    // 1. Percentage Parameters (Need /100)
    const percentParams = [
        'S_CAGR_START', 'S_CAGR_END', 'S_VOL_START', 'S_VOL_END',
        'C_CAGR_START', 'C_CAGR_END', 'C_VOL_START', 'C_VOL_END',
        'B_CAGR_START', 'B_VOL_START',
        'INFL_MEAN', 'INFL_VOL'
    ];

    percentParams.forEach(param => {
        const el = document.getElementById('inp-' + param.toLowerCase().replace(/_/g, '-'));
        if (el) configs[param] = parseFloat(el.value) / 100;
    });

    // 2. Raw Parameters (Keep as is: Correlation is 0.20, Bad Years is int)
    // 2. Raw Parameters
    const rawParams = [
        'CORR_START', 'CORR_END',
        'MAX_CONSECUTIVE_BAD_YEARS',
        'CEILING_EARLY', 'CEILING_LATE'
    ];

    rawParams.forEach(param => {
        const el = document.getElementById('inp-' + param.toLowerCase().replace(/_/g, '-'));
        if (el) configs[param] = parseFloat(el.value);
    });

    // Special: Convert Floor Cut to Floor %
    const cutVal = parseFloat(document.getElementById('inp-floor-cut').value) || 0;
    configs.FLOOR_PCT = 100 - cutVal;

    // Crash Settings
    if (document.getElementById('chk-force-start-crash').checked) {
        configs.FORCE_CRASH = true;
        configs.CRASH_DURATION = parseInt(document.getElementById('inp-crash-duration').value) || 3;
    }

    // 2. Generate Market Data
    // Note: generateMarketData is now global
    const marketData = window.generateMarketData(configs.numSims, configs.years, configs);

    // 3. Run Calibration (SWR)
    const targetOdds = configs.TARGET_SUCCESS_PERCENT / 100;
    const swr = window.findSWR(targetOdds, marketData, configs);
    const safeWithdrawalAmount = (configs.INVESTED_AMOUNT + configs.CASH_BUFFER) * swr;

    // 4. Run Main Simulation (at requested spend)
    const withdrawalRate = -1; // Flag to use fixed spend
    const res = window.simulatePortfolio(withdrawalRate, marketData, configs);

    // 5. Update UI Results - Comprehensive Field Updates
    const totalCapital = configs.INVESTED_AMOUNT + configs.CASH_BUFFER;
    const plannedWR = (configs.TARGET_ANNUAL_EXP / totalCapital) * 100;
    const requiredCapital = configs.TARGET_ANNUAL_EXP / swr;
    const shortfall = requiredCapital - totalCapital;

    // Success Metrics
    const successRateEl = document.getElementById('res-success-rate');
    const successValEl = document.getElementById('res-success-val');
    if (successRateEl) successRateEl.innerText = (res.successRate * 100).toFixed(1) + "%";
    if (successValEl) successValEl.innerText = (res.successRate * 100).toFixed(1) + "%";

    const plannedWREl = document.getElementById('res-planned-wr');
    if (plannedWREl) plannedWREl.innerText = plannedWR.toFixed(2);

    // Required Capital & Shortfall
    const reqCapitalEl = document.getElementById('res-required-capital');
    if (reqCapitalEl) reqCapitalEl.innerText = Formatters.formatCurrency(requiredCapital);

    const shortfallEl = document.getElementById('res-shortfall-val');
    if (shortfallEl) {
        if (shortfall > 0) {
            shortfallEl.innerText = "+ " + Formatters.formatCurrency(shortfall);
            document.getElementById('lbl-shortfall')?.classList.add('text-red-600');
        } else {
            shortfallEl.innerText = Formatters.formatCurrency(Math.abs(shortfall)) + " surplus";
            document.getElementById('lbl-shortfall')?.classList.add('text-green-600');
        }
    }

    // SWR Display
    const swrEl = document.getElementById('res-swr');
    const swrValEl = document.getElementById('res-swr-val');
    const swrAmountEl = document.getElementById('res-swr-amount');
    const swrTargetLabelEl = document.getElementById('res-swr-target-label');

    if (swrEl) swrEl.innerText = (swr * 100).toFixed(2) + "%";
    if (swrValEl) swrValEl.innerText = (swr * 100).toFixed(2) + "%";
    if (swrAmountEl) swrAmountEl.innerText = Formatters.formatCurrency(safeWithdrawalAmount);
    if (swrTargetLabelEl) swrTargetLabelEl.innerText = (swr * 100).toFixed(2);

    // Monthly Budget at Target Success Rate
    const safeMonthly = safeWithdrawalAmount / 12;
    const safeMonthlyEl = document.getElementById('res-safe-monthly');
    const targetPtrEl = document.getElementById('res-target-ptr');
    if (safeMonthlyEl) safeMonthlyEl.innerText = Formatters.formatCurrency(safeMonthly, 0);
    if (targetPtrEl) targetPtrEl.innerText = configs.TARGET_SUCCESS_PERCENT.toFixed(0);

    // Calculate other risk profiles (99% and 90%)
    const swr99 = window.findSWR(0.99, marketData, configs);
    const swr90 = window.findSWR(0.90, marketData, configs);
    const monthly99 = (totalCapital * swr99) / 12;
    const monthly90 = (totalCapital * swr90) / 12;

    const safe99El = document.getElementById('res-safe-99');
    const safe90El = document.getElementById('res-safe-90');
    const swr99El = document.getElementById('res-swr-99');
    const swr90El = document.getElementById('res-swr-90');

    if (safe99El) safe99El.innerText = Formatters.formatCurrency(monthly99, 0);
    if (safe90El) safe90El.innerText = Formatters.formatCurrency(monthly90, 0);
    if (swr99El) swr99El.innerText = (swr99 * 100).toFixed(2);
    if (swr90El) swr90El.innerText = (swr90 * 100).toFixed(2);

    // Max monthly (using highest wealth scenario)
    const maxWealth = Math.max(...res.wealths);
    const maxMonthly = (maxWealth * 0.04) / 12; // Rough estimate
    const maxMonthlyEl = document.getElementById('res-max-monthly');
    if (maxMonthlyEl) maxMonthlyEl.innerText = Formatters.formatCurrency(maxMonthly, 0);

    // Target Monthly Display
    const targetMonthly = configs.TARGET_ANNUAL_EXP / 12;
    const targetMonthlyEl = document.getElementById('lbl-target-monthly');
    if (targetMonthlyEl) targetMonthlyEl.innerText = Formatters.formatCurrency(targetMonthly, 0);

    Renderer.updateSuccessBar(res.successRate, targetOdds);
    Renderer.renderHistogram(res.wealths, 'res-histogram');

    // Median & Worst Case Stats
    const sortedWealths = [...res.wealths].sort((a, b) => a - b);
    const medianWealth = sortedWealths[Math.floor(sortedWealths.length * 0.5)];
    const worstCaseWealth = sortedWealths[Math.floor(sortedWealths.length * 0.01)] || 0;

    const medianEl = document.getElementById('res-median-end');
    const worstEl = document.getElementById('res-worst-case');

    if (medianEl) medianEl.innerText = Formatters.formatCurrency(medianWealth, 0);
    if (worstEl) worstEl.innerText = Formatters.formatCurrency(worstCaseWealth, 0);

    // Show results and hide placeholder
    const resultsContainer = document.getElementById('results-container');
    const resultsPlaceholder = document.getElementById('results-placeholder');
    if (resultsContainer) resultsContainer.classList.remove('hidden');
    if (resultsPlaceholder) resultsPlaceholder.classList.add('hidden');

    // 6. Navigation Logic (Universal Scroll to Results)
    setTimeout(() => {
        const visionSection = document.getElementById('vision-section');
        if (visionSection) {
            visionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
}

// Global alias for inline onclick handlers
window.runSimulation = runSimulation;
