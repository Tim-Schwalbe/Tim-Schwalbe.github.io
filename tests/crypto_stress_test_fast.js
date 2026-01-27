
const Stats = require('../js/statistics.js');
global.Stats = Stats;
const { generateMarketData, simulatePortfolio } = require('../js/engine.js');

console.log("🪙 BITCOIN 'REALITY CHECK' STRESS TEST (FAST MODE)\n");

const stressConfig = {
    years: 30,
    numSims: 100,  // Reduced from 2000 to 100 for speed
    INVESTED_AMOUNT: 1000000,
    CASH_BUFFER: 0,
    ALLOC_STOCKS: 0.0,
    ALLOC_CRYPTO: 1.0,
    TARGET_ANNUAL_EXP: 30000,

    // Scenario: "User's Reality" (High Vol, Modest Growth)
    // CAGR: 15% flat 
    // Vol: 60% flat
    C_CAGR_START: 0.15, C_CAGR_END: 0.15,
    C_VOL_START: 0.60, C_VOL_END: 0.60,

    // Default unused params
    S_CAGR_START: 0.1, S_CAGR_END: 0.1, S_VOL_START: 0.2, S_VOL_END: 0.2,
    B_CAGR_START: 0.05, B_VOL_START: 0.05, INFL_MEAN: 0.03, INFL_VOL: 0.01,
    CORR_START: 0.2, CORR_END: 0.2,
    FLOOR_MULT: 0, CEILING_EARLY: 1000, CEILING_LATE: 1000, RANDOM_SEED: 123
};

function testRate(rate) {
    stressConfig.TARGET_ANNUAL_EXP = 1000000 * rate;
    const res = simulatePortfolio(rate, generateMarketData(stressConfig.numSims, stressConfig.years, stressConfig), stressConfig);
    console.log(`  ${(rate * 100).toFixed(0)}% Withdrawal => ${(res.successRate * 100).toFixed(1)}% Success`);
    return res.successRate;
}

console.log("Scenario: 15% CAGR, 60% Volatility (High Stress)");
testRate(0.06); // Expect Fail
testRate(0.04); // Expect Fail
testRate(0.03); // Expect Borderline
testRate(0.02); // Expect Safe

console.log("\nVerdict: If High Growth (32%) is replaced with Moderate Growth (15%),");
console.log("SWR should collapse from 6% to ~2-3%.");
