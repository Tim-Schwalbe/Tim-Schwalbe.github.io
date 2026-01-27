
const Stats = require('../js/statistics.js');
global.Stats = Stats;
const { generateMarketData, simulatePortfolio } = require('../js/engine.js');

console.log("🐛 DEBUGGING CASH BUFFER CRASH SCENARIO\n");

const crashConfig = {
    years: 30,
    numSims: 100,
    INVESTED_AMOUNT: 1500000,
    CASH_BUFFER: 4000000, // Huge buffer (covers 30y+ inflation)
    ALLOC_STOCKS: 0.0,
    ALLOC_CRYPTO: 1.0,
    TARGET_ANNUAL_EXP: 60000,

    // Crash Settings
    FORCE_CRASH: true,
    CRASH_DURATION: 5, // 5 Years of pain

    // Explicitly define "Bad Years" if it exists in engine (it doesn't, but let's be safe)

    // Standard Params
    C_CAGR_START: 0.15, C_CAGR_END: 0.15, C_VOL_START: 0.60, C_VOL_END: 0.60,
    S_CAGR_START: 0.1, S_CAGR_END: 0.1, S_VOL_START: 0.2, S_VOL_END: 0.2,
    B_CAGR_START: 0.05, B_VOL_START: 0.05, INFL_MEAN: 0.031, INFL_VOL: 0.015,
    CORR_START: 0.2, CORR_END: 0.2,
    FLOOR_MULT: 0, CEILING_EARLY: 1000, CEILING_LATE: 1000, RANDOM_SEED: 123
};

console.log("Expected Behavior: 100% Success (Cash $2M covers $60k spend for 33 years)");
const res = simulatePortfolio(-1, generateMarketData(crashConfig.numSims, crashConfig.years, crashConfig), crashConfig);
console.log(`Success Rate: ${(res.successRate * 100).toFixed(1)}%`);

if (res.wealths.some(w => w === 0)) {
    // Find average failure year
    // Note: The current simulator doesn't return failure year per sim, usually.
    // But we can infer if wealth is 0.
    // Let's modify the engine simply to log first failure? No, can't easily.
    // We will just verify the math manually.
    const avgWealth = res.wealths.reduce((a, b) => a + b, 0) / res.wealths.length;
    console.log(`Average Final Wealth: $${(avgWealth / 1000000).toFixed(2)}M`);
}

if (res.successRate < 0.1) {
    console.log("❌ BUG REPRODUCED: Massive Cash Buffer ignored/insufficient!");
} else {
    console.log("✅ SIMULATION CORRECT: Cash Buffer saved the day.");
}

console.log(`\nSafe Withdrawal Rate (Calculated internally?): ~${(60000 / 3500000 * 100).toFixed(2)}%`);
