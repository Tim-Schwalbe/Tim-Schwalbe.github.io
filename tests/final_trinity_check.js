
const Stats = require('../js/statistics.js');
global.Stats = Stats;
const { generateMarketData, simulatePortfolio } = require('../js/engine.js');

console.log("=".repeat(60));
console.log("TRINITY COMPLIANCE FINAL VERIFICATION");
console.log("=".repeat(60) + "\n");

const trinityConfig = {
    years: 30,
    numSims: 1000,
    INVESTED_AMOUNT: 1500000,
    CASH_BUFFER: 0,
    ALLOC_STOCKS: 0.50,
    ALLOC_CRYPTO: 0,
    TARGET_ANNUAL_EXP: 60000,
    S_CAGR_START: 0.103, S_CAGR_END: 0.103,
    S_VOL_START: 0.20, S_VOL_END: 0.20,
    B_CAGR_START: 0.052, B_VOL_START: 0.06,
    INFL_MEAN: 0.031, INFL_VOL: 0.015,
    CORR_START: 0.20, CORR_END: 0.20,
    RANDOM_SEED: 42
};

console.log("Testing Trinity Study parameters:");
console.log("  Capital: $1,500,000");
console.log("  Annual Spend: $60,000 (4.0% withdrawal)");
console.log("  Allocation: 50% Stocks / 50% Bonds");
console.log("  Stock Return: 10.3%, Volatility: 20%");
console.log("  Bond Return: 5.2%, Volatility: 6%");
console.log("  Correlation: 0.20");
console.log("  Inflation: 3.1%\n");

const data = generateMarketData(1000, 30, trinityConfig);
const res = simulatePortfolio(-1, data, trinityConfig);

console.log("RESULT:");
console.log(`  Success Rate: ${(res.successRate * 100).toFixed(1)}%`);
console.log(`  Expected (Trinity): 93-96%\n`);

if (res.successRate >= 0.92 && res.successRate <= 0.98) {
    console.log("✅ PASS: Result matches Trinity Study");
} else if (res.successRate > 0.98) {
    console.log("❌ FAIL: Too optimistic (" + (res.successRate * 100).toFixed(1) + "%)");
    console.log("\nThis suggests one of:");
    console.log("  1. Browser using different random number generator");
    console.log("  2. Browser code has bugs not present in Node");
    console.log("  3. Correlation not being applied in browser");
} else {
    console.log("❌ FAIL: Too pessimistic (" + (res.successRate * 100).toFixed(1) + "%)");
}

console.log("\n" + "=".repeat(60));
console.log("If Node shows ~93% but browser shows ~99%,");
console.log("the browser is NOT using the updated js/engine.js file.");
console.log("=".repeat(60));
