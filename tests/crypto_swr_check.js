
const Stats = require('../js/statistics.js');
global.Stats = Stats;
const { generateMarketData, simulatePortfolio } = require('../js/engine.js');

console.log("🪙 100% CRYPTO SWR STRESS TEST\n");

// Parameters from index.html (Assumed defaults)
// CAGR: 0.32 -> 0.08
// VOL: 0.40 -> 0.20
const cryptoConfig = {
    years: 30,
    numSims: 5000,
    INVESTED_AMOUNT: 1000000,
    CASH_BUFFER: 0,
    ALLOC_STOCKS: 0.0,
    ALLOC_CRYPTO: 1.0, // 100% Crypto
    TARGET_ANNUAL_EXP: 60000, // 6% Start

    // Crypto Defaults
    C_CAGR_START: 0.32, C_CAGR_END: 0.08,
    C_VOL_START: 0.40, C_VOL_END: 0.20,

    // Other assets (unused but needed for correlation engine)
    S_CAGR_START: 0.103, S_CAGR_END: 0.103, S_VOL_START: 0.20, S_VOL_END: 0.20,
    B_CAGR_START: 0.052, B_VOL_START: 0.06,
    INFL_MEAN: 0.031, INFL_VOL: 0.015,
    CORR_START: 0.20, CORR_END: 0.20,

    FLOOR_MULT: 0,
    CEILING_EARLY: 1000,
    CEILING_LATE: 1000,

    RANDOM_SEED: 12345
};

console.log("Parameters:");
console.log("  CAGR: 32% -> 8% (Linear decay over 30y)");
console.log("  VOL : 40% -> 20% (Linear decay over 30y)");
console.log("  Withdrawal Rate: 6.0%\n");

const res = simulatePortfolio(0.06, generateMarketData(cryptoConfig.numSims, cryptoConfig.years, cryptoConfig), cryptoConfig);

console.log(`Success Rate at 6.0%: ${(res.successRate * 100).toFixed(2)}%`);

// Calculate Geometric Mean Approximation
// Avg CAGR ~ 20%?
// Avg Vol ~ 30%?
const avgCagr = (0.32 + 0.08) / 2;
const avgVol = (0.40 + 0.20) / 2;
const volDrag = (avgVol * avgVol) / 2;
const geoMean = avgCagr - volDrag;

console.log("\nRough Math Check:");
console.log(`  Avg Volatility: ${(avgVol * 100).toFixed(0)}%`);
console.log(`  Volatility Drag: ~${(volDrag * 100).toFixed(1)}%`);
console.log(`  Estimated GeoMean: ~${(geoMean * 100).toFixed(1)}%`);
console.log("\nInterpretation:");
if (res.successRate > 0.90) {
    console.log("  The massive Drift (Growth) is outpacing the Volatility Sequence Risk.");
    console.log("  Even with 40% drops, the 20-30% recovery years are saving the portfolio.");
} else {
    console.log("  Volatility is killing the portfolio despite high returns.");
}
