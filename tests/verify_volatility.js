
const Stats = require('../js/statistics.js');
global.Stats = Stats;
const { generateMarketData, simulatePortfolio } = require('../js/engine.js');

console.log("🔍 INVESTIGATING: Is Crypto Volatility Working?\n");

// Test: Same returns, different volatility
// If volatility matters, success rate should DROP with higher vol

// Scenario A: Low Volatility Crypto (10%)
const cfgLowVol = {
    years: 30, numSims: 500,
    INVESTED_AMOUNT: 1000000, CASH_BUFFER: 0,
    ALLOC_CRYPTO: 1.0, ALLOC_STOCKS: 0,
    TARGET_ANNUAL_EXP: 60000, // 6% withdrawal
    C_CAGR_START: 0.20, C_CAGR_END: 0.20, // Flat 20%
    C_VOL_START: 0.10, C_VOL_END: 0.10 // LOW volatility
};

const dataLowVol = generateMarketData(500, 30, cfgLowVol);
const resLowVol = simulatePortfolio(-1, dataLowVol, cfgLowVol);

// Scenario B: High Volatility Crypto (50%)
const cfgHighVol = {
    ...cfgLowVol,
    C_VOL_START: 0.50, C_VOL_END: 0.50 // HIGH volatility
};

const dataHighVol = generateMarketData(500, 30, cfgHighVol);
const resHighVol = simulatePortfolio(-1, dataHighVol, cfgHighVol);

console.log(`Low Volatility (10%):  Success = ${(resLowVol.successRate * 100).toFixed(1)}%`);
console.log(`High Volatility (50%): Success = ${(resHighVol.successRate * 100).toFixed(1)}%`);

const penalty = resLowVol.successRate - resHighVol.successRate;
console.log(`\nVolatility Penalty: ${(penalty * 100).toFixed(1)}%`);

if (penalty < 0.10) {
    console.log("\n❌ PROBLEM: Volatility penalty is too small!");
    console.log("Expected: Low vol should have 10-20% higher success rate");
    console.log("This suggests volatility might not be properly penalizing SWR.");
} else {
    console.log("\n✅ Volatility penalty looks reasonable.");
}
