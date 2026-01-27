
const Stats = require('../js/statistics.js');
global.Stats = Stats;
const { generateMarketData, simulatePortfolio } = require('../js/engine.js');

console.log("📉 VOLATILITY DRAG DEMONSTRATION\n");

// Scenario A: The Current Defaults (High Growth, High Vol)
// CAGR: ~20% Avg, Vol: ~30% Avg
const currentConfig = {
    years: 30, numSims: 1000, INVESTED_AMOUNT: 1000000, CASH_BUFFER: 0,
    ALLOC_STOCKS: 0, ALLOC_CRYPTO: 1, TARGET_ANNUAL_EXP: 60000,
    C_CAGR_START: 0.32, C_CAGR_END: 0.08,
    C_VOL_START: 0.40, C_VOL_END: 0.20,
    FLOOR_MULT: 0, CEILING_EARLY: 1000, CEILING_LATE: 1000, RANDOM_SEED: 123
};

// Scenario B: Stock Growth, Crypto Volatility (The "Killer" Scenario)
// CAGR: 10% (Like Stocks), Vol: 40% (Like Crypto)
const killerConfig = {
    ...currentConfig,
    C_CAGR_START: 0.10, C_CAGR_END: 0.10,
    C_VOL_START: 0.40, C_VOL_END: 0.40
};

console.log("Test 1: Current Crypto (32% Return / 40% Vol)");
const res1 = simulatePortfolio(0.06, generateMarketData(1000, 30, currentConfig), currentConfig);
console.log(`  Success @ 6%: ${(res1.successRate * 100).toFixed(1)}%`);

console.log("\nTest 2: 'Stock-Like' Return (10%) with Crypto Vol (40%)");
const res2 = simulatePortfolio(0.02, generateMarketData(1000, 30, killerConfig), killerConfig);
console.log(`  Success @ 2%: ${(res2.successRate * 100).toFixed(1)}%`);

// Calculate Geo Means
const volDragCurrent = (0.30 * 0.30) / 2; // ~4.5%
const geoMeanCurrent = 0.20 - volDragCurrent; // 15.5%

const volDragKiller = (0.40 * 0.40) / 2; // ~8.0%
const geoMeanKiller = 0.10 - volDragKiller; // 2.0%

console.log("\nMathematical Explanation:");
console.log(`  Current GeoMean: ~${(geoMeanCurrent * 100).toFixed(1)}% (Supports 6% WD)`);
console.log(`  High-Vol Low-Return GeoMean: ~${(geoMeanKiller * 100).toFixed(1)}% (Barely supports 2% WD)`);
