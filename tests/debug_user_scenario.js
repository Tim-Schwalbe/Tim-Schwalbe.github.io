
const Stats = require('../js/statistics.js');
global.Stats = Stats;
const { generateMarketData, simulatePortfolio } = require('../js/engine.js');

console.log("🔍 EXACT USER SCENARIO TEST\n");

// Exact parameters from user's console output
const userScenario = {
    years: 30,
    numSims: 1000,
    INVESTED_AMOUNT: 1500000,
    CASH_BUFFER: 0,
    ALLOC_STOCKS: 0.50,
    ALLOC_CRYPTO: 0,
    TARGET_ANNUAL_EXP: 60000,

    // Trinity parameters (from user's log)
    S_CAGR_START: 0.103,
    S_CAGR_END: 0.103,
    S_VOL_START: 0.20,
    S_VOL_END: 0.20,

    B_CAGR_START: 0.052,
    B_VOL_START: 0.06,

    INFL_MEAN: 0.031,
    INFL_VOL: 0.015,

    CORR_START: 0.20,
    CORR_END: 0.20,

    RANDOM_SEED: 2025
};

console.log("Testing User's Exact Scenario:");
console.log("  $1.5M Capital");
console.log("  $60k Annual Spend (4% WR)");
console.log("  50/50 Stocks/Bonds");
console.log("  Trinity Parameters\n");

const data = generateMarketData(1000, 30, userScenario);
const res = simulatePortfolio(-1, data, userScenario);

console.log(`Result: ${(res.successRate * 100).toFixed(1)}% success\n`);

if (res.successRate > 0.98) {
    console.log("❌ PROBLEM: Too optimistic!");
    console.log("Expected: 92-96% (Trinity range)");
    console.log("Got: " + (res.successRate * 100).toFixed(1) + "%");
    console.log("\nPossible causes:");
    console.log("1. Browser cache (hard refresh needed)");
    console.log("2. Correlation bug");
    console.log("3. Number of simulations too low");
} else if (res.successRate < 0.90) {
    console.log("❌ PROBLEM: Too pessimistic!");
    console.log("Expected: 92-96% (Trinity range)");
} else {
    console.log("✅ LOOKS CORRECT!");
    console.log("Success rate in Trinity range (90-98%)");
}

// Also test at different withdrawal rates to see the pattern
console.log("\n--- Testing Different Withdrawal Rates ---");
[0.03, 0.04, 0.05, 0.06].forEach(rate => {
    const cfg = { ...userScenario, INVESTED_AMOUNT: 1000000, TARGET_ANNUAL_EXP: 0 };
    const r = simulatePortfolio(rate, data, cfg);
    console.log(`${(rate * 100).toFixed(0)}%: ${(r.successRate * 100).toFixed(1)}% success`);
});
