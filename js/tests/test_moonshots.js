// Test Script for Moonshot / 3-Regime Logic
// Run this in the browser console or via a test runner

(function runTest() {
    console.log("🚀 Starting Moonshot Regime Test...");

    // Mock Configs
    const configs = {
        USE_FAT_TAILS: true,
        USE_MOONSHOTS: true, // Enable Moonshots
        PROB_CRASH: 0.05,
        PROB_MOONSHOT: 0.05, // Base probability

        // Asset Params (Crypto Only)
        C_CAGR_START: 0.15, C_CAGR_END: 0.15,
        C_VOL_START: 0.60, C_VOL_END: 0.60,

        // Disable others
        S_CAGR_START: 0, S_CAGR_END: 0, S_VOL_START: 0, S_VOL_END: 0,
        B_CAGR_START: 0, B_VOL_START: 0,
        INFL_MEAN: 0, INFL_VOL: 0,
        CORR_START: 0, CORR_END: 0,

        RANDOM_SEED: 12345
    };

    const numSims = 1000;
    const years = 30;
    const months = years * 12;

    // Run Engine
    const data = window.generateMarketData(numSims, years, configs);
    const crypto = data.cryptoLogReturns; // Float64Array

    // Analyze Results
    let totalCrashes = 0;
    let totalMoonshots = 0;
    let recoveryMoonshots = 0; // Moonshots that happened within 24m of a crash

    let simulatedMonthsSinceCrash = 100;
    let crashMonthsIndices = new Set();

    // We need to re-simulate the random logic to count expected events? 
    // No, we can just analyze the RETURNS distribution.
    // Crash Returns: < -25% (approx -30% to -60%)
    // Moonshot Returns: > +25% (approx +30% to +80%)

    // Let's count significant events
    let counts = {
        crash: 0,
        moonshot: 0,
        normal: 0
    };

    let returns = [];

    for (let i = 0; i < crypto.length; i++) {
        const logRet = crypto[i];
        const pctRet = Math.exp(logRet) - 1;
        returns.push(pctRet);

        if (pctRet < -0.25) counts.crash++;
        else if (pctRet > 0.25) counts.moonshot++;
        else counts.normal++;
    }

    // Calc Stats
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const min = Math.min(...returns);
    const max = Math.max(...returns);

    // Sort for median/percentiles
    returns.sort((a, b) => a - b);
    const median = returns[Math.floor(returns.length / 2)];

    console.log("📊 Moonshot Test Results:");
    console.log(`Total Months: ${crypto.length}`);
    console.log(`Crashes (< -25%): ${counts.crash} (${(counts.crash / crypto.length * 100).toFixed(2)}%)`);
    console.log(`Moonshots (> +25%): ${counts.moonshot} (${(counts.moonshot / crypto.length * 100).toFixed(2)}%)`);
    console.log(`Mean Monthly Return: ${(mean * 100).toFixed(2)}%`);
    console.log(`Median Monthly Return: ${(median * 100).toFixed(2)}%`);
    console.log(`Best Month: ${(max * 100).toFixed(2)}%`);
    console.log(`Worst Month: ${(min * 100).toFixed(2)}%`);

    // Validation
    const crashRateOk = counts.crash > (crypto.length * 0.04) && counts.crash < (crypto.length * 0.06);
    const moonshotRateOk = counts.moonshot > (crypto.length * 0.04); // Should be > 5% due to recovery boost

    console.log("--------------------------------");
    console.log(`Crash Rate (Target ~5%): ${crashRateOk ? "PASS" : "FAIL"}`);
    console.log(`Moonshot Rate (Target >5%): ${moonshotRateOk ? "PASS" : "FAIL"}`);

})();
