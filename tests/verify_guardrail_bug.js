
const Stats = require('../js/statistics.js');
global.Stats = Stats;
const { generateMarketData, simulatePortfolio } = require('../js/engine.js');

console.log("🔍 GUARDRAIL BUG VERIFICATION\n");

const baseConfig = {
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

// Test 1: No Guardrails (FLOOR_MULT undefined)
const cfg1 = { ...baseConfig };
delete cfg1.FLOOR_MULT;
const res1 = simulatePortfolio(-1, generateMarketData(1000, 30, cfg1), cfg1);
console.log(`No Guardrails (Trinity): ${(res1.successRate * 100).toFixed(1)}% success`);

// Test 2: Browser Defaults (FLOOR_MULT=0, CEILING=100)
const cfg2 = {
    ...baseConfig,
    FLOOR_MULT: 0.0,
    CEILING_EARLY: 100,
    CEILING_LATE: 100
};
const res2 = simulatePortfolio(-1, generateMarketData(1000, 30, cfg2), cfg2);
console.log(`With Browser Guardrails (Ceiling 100%): ${(res2.successRate * 100).toFixed(1)}% success`);

if (res2.successRate > res1.successRate + 0.05) {
    console.log("\n🎯 BUG CONFIRMED!");
    console.log("The 100% Ceiling is capping inflation, making the portfolio unrealistically safe.");
}
