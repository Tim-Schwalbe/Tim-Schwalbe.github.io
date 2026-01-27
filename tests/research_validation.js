
const Stats = require('../js/statistics.js');
global.Stats = Stats;
const { generateMarketData, simulatePortfolio } = require('../js/engine.js');

console.log("📊 SWR RESEARCH VALIDATION TEST\n");

// Common Research Benchmarks for SWR (30 Years, 50/50 - 60/40 Stocks/Bonds)
// 1. Bengen (1994) - Historical: ~4.0% (Worst case: 1966)
// 2. Morningstar (2021) - Monte Carlo: ~3.3% - 3.8% (Targeting 90-95% success)
// 3. Trinity Update (1998) - Historical: ~95% success at 4.0%

const baseConfig = {
    years: 30,
    numSims: 2000, // Higher count for precision
    INVESTED_AMOUNT: 1000000,
    CASH_BUFFER: 0,
    ALLOC_STOCKS: 0.50,
    ALLOC_CRYPTO: 0,
    TARGET_ANNUAL_EXP: 40000, // 4% Start

    // Standard Research Assumptions (Conservative/Realistic)
    // Stocks: 10.3% arithmetic mean -> ~8.5% geometric mean? 
    // Wait, our inputs are Arithmetic Mean (CAGR approx?). 
    // Trinity input S_CAGR = 10.3%.
    // S_VOL = 20%.

    S_CAGR_START: 0.103, S_CAGR_END: 0.103,
    S_VOL_START: 0.20, S_VOL_END: 0.20,

    B_CAGR_START: 0.052, B_VOL_START: 0.06,
    INFL_MEAN: 0.031, INFL_VOL: 0.015,
    CORR_START: 0.20, CORR_END: 0.20,

    // No guardrails for pure benchmark
    FLOOR_MULT: 0,
    CEILING_EARLY: 1000,
    CEILING_LATE: 1000,

    RANDOM_SEED: 12345
};

function testSWR(targetSuccess, withdrawalRate) {
    const cfg = { ...baseConfig };
    // withdrawalRate passed as decimal (e.g., 0.04)
    // simulatePortfolio takes withdrawalRate. If > 0, calculate exp.

    const res = simulatePortfolio(withdrawalRate, generateMarketData(cfg.numSims, cfg.years, cfg), cfg);
    return res.successRate;
}

console.log("---------------------------------------------------");
console.log("Checking 4% Rule (Historical Benchmark)");
const successRate4pct = testSWR(0.95, 0.04);
console.log(`4.0% Withdrawal Success Rate: ${(successRate4pct * 100).toFixed(2)}%`);

if (successRate4pct >= 0.92 && successRate4pct <= 0.96) {
    console.log("✅ RESULT ALIGNED: ~93-95% is consistent with random Monte Carlo showing 'slightly worse than history' tails.");
} else {
    console.log("⚠️ RESULT DEVIATION: Outside expected 92-96% range.");
}

console.log("\n---------------------------------------------------");
console.log("Searching for actual 95% SWR...");
// Binary search for 95% success
let low = 0.030;
let high = 0.040;
let safeRate = 0;

for (let i = 0; i < 10; i++) {
    const mid = (low + high) / 2;
    const rate = testSWR(0.95, mid);
    if (rate > 0.95) {
        safeRate = mid;
        low = mid; // We can withdraw more
    } else {
        high = mid; // Withdrawing too much
    }
}
console.log(`Rate for >95% Success: ${(low * 100).toFixed(2)}%`);

console.log("\n---------------------------------------------------");
console.log("Comparison to Research:");
console.log("Morningstar (2021): ~3.3% - 3.8% (Conservative MC)");
console.log("Bengen (Historical): 4.0% (1966 Cohort was safe)");
console.log("Wade Pfau (Safety First): < 3.0% (Risk Averse)");
