
const Stats = require('../js/statistics.js');
global.Stats = Stats;
const { generateMarketData, simulatePortfolio } = require('../js/engine.js');

console.log("🔍 TRINITY STUDY REPLICATION TEST\n");

// Exact Trinity Study parameters
const trinityConfig = {
    years: 30,
    numSims: 1000,
    INVESTED_AMOUNT: 1000000,
    CASH_BUFFER: 0,
    ALLOC_STOCKS: 0.50,
    ALLOC_CRYPTO: 0,
    TARGET_ANNUAL_EXP: 0,

    // Historical US market parameters (1926-1995 average)
    S_CAGR_START: 0.103,  // 10.3% nominal
    S_CAGR_END: 0.103,
    S_VOL_START: 0.20,    // 20% volatility
    S_VOL_END: 0.20,

    B_CAGR_START: 0.052,  // 5.2% nominal
    B_VOL_START: 0.06,    // 6% volatility

    INFL_MEAN: 0.031,     // 3.1% inflation
    INFL_VOL: 0.015,

    CORR_START: 0.20,     // Stock-bond correlation ~0.20 historically
    CORR_END: 0.20,

    RANDOM_SEED: 42       // Reproducible
};

console.log("Parameters (matching Trinity Study):");
console.log("  50% Stocks: 10.3% return, 20% volatility");
console.log("  50% Bonds: 5.2% return, 6% volatility");
console.log("  Inflation: 3.1%");
console.log("  Time: 30 years\n");

const data = generateMarketData(1000, 30, trinityConfig);

// Test different withdrawal rates
console.log("Testing withdrawal rates:\n");

const testRates = [
    { rate: 0.03, label: "3% (Very Safe)" },
    { rate: 0.04, label: "4% (Trinity Rule)" },
    { rate: 0.05, label: "5% (Aggressive)" },
    { rate: 0.06, label: "6% (Very Aggressive)" }
];

testRates.forEach(test => {
    const res = simulatePortfolio(test.rate, data, trinityConfig);
    const success = (res.successRate * 100).toFixed(1);
    console.log(`${test.label.padEnd(30)} → ${success}% success`);
});

console.log("\n--- Expected Trinity Results ---");
console.log("3%: ~100% success");
console.log("4%: ~95-98% success ← Trinity Rule");
console.log("5%: ~85-90% success");
console.log("6%: ~75-80% success");
console.log("\nIf your results match these, the simulation is correct!");
console.log("If 4% shows >99% success, parameters might be too optimistic.");
