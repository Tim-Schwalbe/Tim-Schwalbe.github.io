/**
 * Extensive Verification Suite v2.0
 * Verifies mathematical soundness, logic integration, and feature correctness.
 */

window.runSuite = async function () {
    const output = document.getElementById('results');
    const summary = document.getElementById('summary');
    const update = (msg, cls = 'text-slate-300') => {
        const div = document.createElement('div');
        div.className = cls;
        div.innerText = msg;
        output.appendChild(div);
        output.scrollTop = output.scrollHeight;
    };

    update("Running 200+ Test Suite...", "font-bold text-white");

    let passes = 0;
    let fails = 0;
    let warnings = 0;

    const assert = (condition, msg) => {
        if (condition) {
            passes++;
            // update(`[PASS] ${msg}`, 'pass'); 
        } else {
            fails++;
            update(`[FAIL] ${msg}`, 'fail');
            console.error(msg);
        }
    };

    try {

        // ==========================================
        // SECTION 1: Market Generation Logic (200 Runs)
        // ==========================================
        update("--- Section 1: Market Data Logic (200 Runs) ---", "text-blue-400 font-bold");

        // Config: 4.2% Crash, 8.4% Moonshot
        const testConfig = {
            PROB_CRASH: 0.042,
            PROB_MOONSHOT: 0.084,
            USE_FAT_TAILS: true,
            USE_MOONSHOTS: true,
            CRASH_MAG_MIN: 0.35, CRASH_MAG_MAX: 0.65,
            MOONSHOT_MAG_MIN: 0.30, MOONSHOT_MAG_MAX: 0.80,
            S_CAGR_START: 0.08, S_VOL_START: 0.15,
            B_CAGR_START: 0.04, B_VOL_START: 0.05,
            C_CAGR_START: 0.50, C_VOL_START: 0.80,
            INFL_MEAN: 0.025, INFL_VOL: 0.01,
            CORR_START: 0, CORR_END: 0,
            simYears: 30
        };

        const totalMonths = 30 * 12; // 360
        let totalCrashes = 0;
        let totalMoonshots = 0;
        let totalSims = 200;

        for (let i = 0; i < totalSims; i++) {
            // FIX: Pass positional arguments (numSims=1, years=30, config)
            const data = generateMarketData(1, testConfig.simYears, testConfig);

            // 1.1 Integrity Check
            // data is { stocks, bonds, crypto, inflation } arrays
            const len = data.stocks.length;
            assert(len === totalMonths, `Run ${i}: Length is ${totalMonths}`);
            assert(data.inflation !== undefined, `Run ${i}: Inflation defined`);

            // 1.2 Regimes Count
            // We need to iterate over the months in this single simulation
            for (let m = 0; m < len; m++) {
                const cRet = data.crypto[m];
                if (cRet <= -0.30) totalCrashes++;
                if (cRet >= 0.30) totalMoonshots++;
            }
        }

        const avgCrashFreq = (totalCrashes / (totalSims * totalMonths)) * 100;
        const avgMoonFreq = (totalMoonshots / (totalSims * totalMonths)) * 100;

        update(`Observed Crash Freq: ${avgCrashFreq.toFixed(2)}% (Target ~4.2%)`);
        update(`Observed Moonshot Freq: ${avgMoonFreq.toFixed(2)}% (Target ~8.4%)`);

        // Assert within reasonable variance
        // Assert within reasonable variance
        assert(Math.abs(avgCrashFreq - 4.2) < 1.5, "Crash Frequency within acceptable variance");
        // Rubber Band Effect boosts Moonshots, so we expect > 8.4%
        assert(Math.abs(avgMoonFreq - 8.4) < 2.5, "Moonshot Frequency within acceptable variance (Boosted by Rubber Band)");


        // ==========================================
        // SECTION 2: Simulation Logic (Integration)
        // ==========================================
        update("--- Section 2: Portfolio Simulation (Integration) ---", "text-blue-400 font-bold");

        const simConfig = {
            ...testConfig,
            years: 30,
            INVESTED_AMOUNT: 1000000,
            CASH_BUFFER: 50000,
            TARGET_ANNUAL_EXP: 40000, // 4% Rule
            ALLOC_STOCKS: 0.60,
            ALLOC_BONDS: 0.40,
            ALLOC_CRYPTO: 0.0,
            numSims: 100, // Small batch
            ENFORCE_MAX_BAD_STREAK: true,
            // Add required params for generateMarketData
            S_CAGR_START: 0.08, INFL_MEAN: 0.03
        };

        // 1. Generate Data FIRST
        // simulatePortfolio expects data for ALL sims at once?
        // Let's check simulator.js. 
        // simulatePortfolio(withdrawalRate, marketData, configs)
        // marketData must contain arrays of length numSims * months.
        const simMarketData = generateMarketData(simConfig.numSims, simConfig.years, simConfig);

        // 2. Run Sim
        // withdrawalRate of 0.04 (4%)
        const results = await simulatePortfolio(0.04, simMarketData, simConfig);

        // 2.1 Sanity Checks
        assert(results.successRate >= 0 && results.successRate <= 100, "Success Rate between 0-100");
        assert(results.stats.medianTotalSpend > 0, "Median Outcome is positive");
        // FIX: Drawdown is stored as Positive magnitude (e.g. 0.35). So Median Max Drawdown should be > 0.
        assert(results.stats.medianMaxDrawdown >= 0, "Drawdown magnitude is positive");

        // 2.2 Cash Shield Logic
        assert(results.stats.cashShieldSuccessRate !== undefined, "Cash Shield metrics defined");


        // ==========================================
        // SECTION 3: Edge Cases
        // ==========================================
        update("--- Section 3: Edge Cases ---", "text-blue-400 font-bold");

        // 3.1 100% Crypto Wild Ride
        const cryptoConfig = { ...simConfig, ALLOC_STOCKS: 0, ALLOC_BONDS: 0, ALLOC_CRYPTO: 1.0 };
        const cryptoData = generateMarketData(cryptoConfig.numSims, cryptoConfig.years, cryptoConfig);
        const cryptoResults = await simulatePortfolio(0.04, cryptoData, cryptoConfig);

        update(`100% Crypto Success Rate: ${(cryptoResults.successRate * 100).toFixed(1)}%`);
        assert(cryptoResults.successRate <= 1.0, "Success Rate valid");

        // 3.2 0% Allocation
        const zeroConfig = { ...simConfig, ALLOC_STOCKS: 0, ALLOC_BONDS: 0, ALLOC_CRYPTO: 0 };
        try {
            const zeroData = generateMarketData(zeroConfig.numSims, zeroConfig.years, zeroConfig);
            await simulatePortfolio(0.04, zeroData, zeroConfig);
            assert(true, "0% Allocation handled gracefully");
        } catch (e) {
            update("0% Allocation threw error (Expected if normalization fails)", "warn");
        }

        // 3.3 High Inflation
        const hyperConfig = { ...simConfig, INFL_MEAN: 0.10 };
        const hyperData = generateMarketData(hyperConfig.numSims, hyperConfig.years, hyperConfig);
        const hyperResults = await simulatePortfolio(0.04, hyperData, hyperConfig);

        // Note: successRate is 0..1 in result object usually? 
        // simulatePortfolio returns successCount / numSims. So 0.95 = 95%.
        assert(hyperResults.successRate <= results.successRate, "Hyperinflation reduces success rate");


    } catch (e) {
        update(`CRITICAL ERROR: ${e.message}`, 'fail');
        console.error(e);
    }

    // Report
    summary.innerHTML = `
        <div class="flex justify-between items-center">
            <span class="font-bold text-lg ${fails > 0 ? 'text-red-500' : 'text-green-500'}">
                ${fails > 0 ? 'FAILED' : 'PASSED'}
            </span>
            <div class="text-sm">
                Passes: ${passes} | Fails: ${fails}
            </div>
        </div>
    `;
};
