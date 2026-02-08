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

    // 4. Init Crash Displays
    if (window.updateCrashAnnualDisplay) window.updateCrashAnnualDisplay();
});

// Helper: Update Crash Annual Displays
window.updateCrashAnnualDisplay = function () {
    const calcAnnual = (monthlyPct) => {
        if (!monthlyPct) return 0;
        // Formula: ((e^(r) )^12 - 1) * 100 where r = monthlyPct/100
        // This matches the log-return application in the engine.
        const r = monthlyPct / 100;
        const annual = (Math.pow(Math.exp(r), 12) - 1) * 100;
        return annual.toFixed(1); // e.g. -45.1
    };

    const updateField = (inputId, dispId) => {
        const input = document.getElementById(inputId);
        const disp = document.getElementById(dispId);
        if (input && disp) {
            const val = parseFloat(input.value) || 0;
            const annual = calcAnnual(val);
            disp.innerText = `~ ${annual}% Annual`;
        }
    };

    updateField('inp-crash-floor-stocks', 'disp-crash-annual-stocks');
    updateField('inp-crash-floor-crypto', 'disp-crash-annual-crypto');
    updateField('inp-crash-floor-bonds', 'disp-crash-annual-bonds');
};

async function runSimulation() {
    console.log("🚀 Starting Simulation...");

    const parseInput = (id, fallback, isInt = true) => {
        const el = document.getElementById(id);
        const val = el ? el.value : "";
        if (val === "") return fallback;
        const num = isInt ? parseInt(val) : parseFloat(val);
        return isNaN(num) ? fallback : num;
    };

    // 1. Gather Configs
    const configs = {
        years: parseInput('inp-years', 30),
        INVESTED_AMOUNT: Formatters.parseFormattedValue(document.getElementById('inp-initial').value),
        CASH_BUFFER: Formatters.parseFormattedValue(document.getElementById('inp-buffer').value),
        TARGET_ANNUAL_EXP: Formatters.parseFormattedValue(document.getElementById('inp-target-annual').value),
        ALLOC_CRYPTO: parseInput('inp-alloc-crypto-pct', 0) / 100,
        ALLOC_STOCKS: parseInput('inp-alloc-stocks-pct', 0) / 100,
        TARGET_SUCCESS_PERCENT: parseInput('inp-target-success', 95, false),

        // Advanced
        numSims: parseInput('inp-num-sims', 1000),
        ENFORCE_MAX_BAD_STREAK: true,
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
        const val = parseInput('inp-' + param.toLowerCase().replace(/_/g, '-'), null, false);
        if (val !== null) configs[param] = val / 100;
    });

    // 2. Raw Parameters
    const rawParams = [
        'CORR_START', 'CORR_END',
        'MAX_CONSECUTIVE_BAD_YEARS',
        'CEILING_EARLY', 'CEILING_LATE'
    ];

    rawParams.forEach(param => {
        const val = parseInput('inp-' + param.toLowerCase().replace(/_/g, '-'), null, false);
        if (val !== null) configs[param] = val;
    });

    // Special: Convert Floor Cut to Floor %
    const cutVal = parseFloat(document.getElementById('inp-floor-cut').value) || 0;
    configs.FLOOR_PCT = 100 - cutVal;

    // Crash Settings
    if (document.getElementById('chk-force-start-crash').checked) {
        configs.FORCE_CRASH = true;
        configs.CRASH_DURATION = parseInput('inp-crash-duration', 3);

        // Read Floors (convert % to decimal)
        configs.CRASH_FLOOR_STOCKS = parseInput('inp-crash-floor-stocks', -5.0, false) / 100;
        configs.CRASH_FLOOR_CRYPTO = parseInput('inp-crash-floor-crypto', -10.0, false) / 100;
        configs.CRASH_FLOOR_BONDS = parseInput('inp-crash-floor-bonds', -1.0, false) / 100;
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
    const lblShortfall = document.getElementById('lbl-shortfall');
    if (shortfallEl && lblShortfall) {
        lblShortfall.classList.remove('text-red-600', 'text-green-600', 'text-red-400', 'text-green-400', 'text-white');
        if (shortfall > 0) {
            shortfallEl.innerText = "+ " + Formatters.formatCurrency(shortfall);
            lblShortfall.classList.add('text-red-400');
        } else {
            shortfallEl.innerText = Formatters.formatCurrency(Math.abs(shortfall)) + " surplus";
            lblShortfall.classList.add('text-green-400');
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

    // Max monthly (realized during the simulation)
    const maxMonthlyEl = document.getElementById('res-max-monthly');
    if (maxMonthlyEl) maxMonthlyEl.innerText = Formatters.formatCurrency(res.stats.maxMonthlySpend, 0);

    // Target Monthly Display
    const targetMonthly = configs.TARGET_ANNUAL_EXP / 12;
    const targetMonthlyEl = document.getElementById('lbl-target-monthly');
    if (targetMonthlyEl) targetMonthlyEl.innerText = Formatters.formatCurrency(targetMonthly, 0);

    Renderer.updateSuccessBar(res.successRate, targetOdds);

    // Median & Worst Case Stats
    const sortedWealths = [...res.wealths].sort((a, b) => a - b);
    const medianWealth = sortedWealths[Math.floor(sortedWealths.length * 0.5)];
    const worstCaseWealth = sortedWealths[Math.floor(sortedWealths.length * 0.01)] || 0;

    const medianEl = document.getElementById('res-median-end');
    const realWealthEl = document.getElementById('res-real-wealth');
    const inflationImpactEl = document.getElementById('res-inflation-impact');
    const worstEl = document.getElementById('res-worst-case');

    if (medianEl) medianEl.innerText = Formatters.formatCurrency(medianWealth, 0);
    if (realWealthEl) realWealthEl.innerText = Formatters.formatCurrency(res.stats.medianRealFinalWealth, 0);

    if (inflationImpactEl && medianWealth > 0) {
        const impact = (res.stats.medianRealFinalWealth / medianWealth) - 1;
        inflationImpactEl.innerText = (impact * 100).toFixed(0) + "% vs. Nominal";
    }

    if (worstEl) worstEl.innerText = Formatters.formatCurrency(worstCaseWealth, 0);

    // Update Portfolio Mix Summary in Results
    const sPct = configs.ALLOC_STOCKS * 100;
    const cPct = configs.ALLOC_CRYPTO * 100;
    const bPct = 100 - sPct - cPct;

    document.getElementById('res-mix-stocks').innerText = sPct.toFixed(0) + "%";
    document.getElementById('res-mix-bonds').innerText = bPct.toFixed(0) + "%";
    document.getElementById('res-mix-crypto').innerText = cPct.toFixed(0) + "%";

    const inv = configs.INVESTED_AMOUNT || 0;
    document.getElementById('res-mix-val-stocks').innerText = `(${Formatters.formatCurrency(inv * (sPct / 100), 0)})`;
    document.getElementById('res-mix-val-bonds').innerText = `(${Formatters.formatCurrency(inv * (bPct / 100), 0)})`;
    document.getElementById('res-mix-val-crypto').innerText = `(${Formatters.formatCurrency(inv * (cPct / 100), 0)})`;

    document.getElementById('bar-mix-stocks').style.width = sPct + "%";
    document.getElementById('bar-mix-bonds').style.width = bPct + "%";
    document.getElementById('bar-mix-crypto').style.width = cPct + "%";

    // --- Deep-Dive Stats (The Mechanics) ---
    if (res.stats) {
        const { stats } = res;

        // Asset Realized Performance
        const calcCAGR = (logReturns) => {
            if (!logReturns || logReturns.length === 0) return 0;
            let sumLog = 0;
            for (let i = 0; i < logReturns.length; i++) {
                sumLog += logReturns[i];
            }
            const avgLogMonthly = sumLog / logReturns.length;
            return (Math.exp(avgLogMonthly * 12) - 1) * 100;
        };

        const rStocks = calcCAGR(marketData.stocks);
        const rBonds = marketData.bonds ? calcCAGR(marketData.bonds) : 0;
        const rCrypto = marketData.crypto ? calcCAGR(marketData.crypto) : 0;

        document.getElementById('res-realized-stocks').innerText = rStocks.toFixed(2) + "%";
        document.getElementById('res-realized-bonds').innerText = rBonds.toFixed(2) + "%";
        document.getElementById('res-realized-crypto').innerText = rCrypto.toFixed(2) + "%";

        // Risk Stats
        document.getElementById('res-median-dd').innerText = (stats.medianMaxDrawdown * 100).toFixed(1) + "%";
        document.getElementById('res-worst-dd').innerText = (stats.worstDrawdown * 100).toFixed(1) + "%";

        // Recovery stats
        document.getElementById('res-median-recovery').innerText = stats.medianDrawdownDuration + " months";
        document.getElementById('res-worst-recovery').innerText = stats.worstDrawdownDuration + " months";

        // Survival Margin
        document.getElementById('res-median-low-cap').innerText = Formatters.formatCurrency(stats.medianLowestCapital, 0);
        document.getElementById('res-absolute-low-cap').innerText = Formatters.formatCurrency(stats.absoluteLowestCapital, 0);

        // Lifestyle & Flexibility
        document.getElementById('res-realized-monthly').innerText = Formatters.formatCurrency(stats.medianMonthlySpend, 0);
        document.getElementById('res-total-lifetime-spend').innerText = Formatters.formatCurrency(stats.medianTotalSpend, 0);

        // Sanity Filter Checks
        if (marketData.info) {
            document.getElementById('res-max-bad-streak').innerText = marketData.info.maxStreakEncountered + " years";
            document.getElementById('res-filter-triggers').innerText = marketData.info.constraintHits.toLocaleString();

            // Hit Rates
            document.getElementById('res-ceiling-usage').innerText = (stats.ceilingHitRate * 100).toFixed(1) + "%";
            document.getElementById('res-floor-usage').innerText = (stats.floorHitRate * 100).toFixed(1) + "%";
        }
    }

    // Show results and hide placeholder
    const resultsContainer = document.getElementById('results-container');
    const resultsPlaceholder = document.getElementById('results-placeholder');
    if (resultsContainer) resultsContainer.classList.remove('hidden');
    if (resultsPlaceholder) resultsPlaceholder.classList.add('hidden');

    // Render histogram after DOM is visible and layout is complete
    // Use requestAnimationFrame to ensure layout/paint cycle completes
    requestAnimationFrame(() => {
        setTimeout(() => {
            Renderer.renderHistogram(res.wealths, 'res-histogram');
        }, 50);
    });

    // 6. Navigation Logic (Universal Scroll to Results)
    // Using a slightly longer delay to ensure DOM and animations have settled
    setTimeout(() => {
        const setupSection = document.getElementById('setup-section');
        if (setupSection) {
            setupSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest'
            });
        }
    }, 150);
}

// Global alias for inline onclick handlers
window.runSimulation = runSimulation;
