
const Stats = require('../js/statistics.js');
global.Stats = Stats;
const { generateMarketData, simulatePortfolio } = require('../js/engine.js');

console.log("🔍 VERIFYING: User's 100% Crypto Scenario\n");

// Exact user scenario from UI defaults
const cfg = {
    years: 30, numSims: 1000,
    INVESTED_AMOUNT: 1500000, CASH_BUFFER: 0,
    ALLOC_CRYPTO: 1.0, ALLOC_STOCKS: 0,
    TARGET_ANNUAL_EXP: 60000,
    C_CAGR_START: 0.32, C_CAGR_END: 0.08,
    C_VOL_START: 0.40, C_VOL_END: 0.20,
    INFL_MEAN: 0.025, INFL_VOL: 0.015
};

const data = generateMarketData(1000, 30, cfg);

// Test different withdrawal rates
const tests = [
    { rate: 0.04, label: "4% (Trinity)" },
    { rate: 0.06, label: "6%" },
    { rate: 0.07, label: "7%" },
    { rate: 0.0718, label: "7.18% (Reported SWR)" },
    { rate: 0.08, label: "8%" },
    { rate: 0.10, label: "10%" }
];

console.log("Testing different withdrawal rates:\n");
tests.forEach(test => {
    const testCfg = { ...cfg, INVESTED_AMOUNT: 1000000, CASH_BUFFER: 0, TARGET_ANNUAL_EXP: 0 };
    const res = simulatePortfolio(test.rate, data, testCfg);
    console.log(`${test.label.padEnd(25)} → ${(res.successRate * 100).toFixed(1)}% success`);
});

console.log("\n--- Analysis ---");
console.log("If 7.18% shows ~95% success, the result is CORRECT.");
console.log("If 7.18% shows >99% success, there might be a bug.");
