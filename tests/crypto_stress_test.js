
const Stats = require('../js/statistics.js');
global.Stats = Stats;
const { generateMarketData, simulatePortfolio } = require('../js/engine.js');

console.log("🪙 BITCOIN 'REALITY CHECK' STRESS TEST\n");

// User's mentioned "Conservative/High-Risk" parameters:
// Volatility: 60% (Upper end of current range)
// SWR Expert Consensus: 2-3%

const stressConfig = {
    years: 30,
    numSims: 2000,
    INVESTED_AMOUNT: 1000000,
    CASH_BUFFER: 0,
    ALLOC_STOCKS: 0.0,
    ALLOC_CRYPTO: 1.0, // 100% Crypto
    TARGET_ANNUAL_EXP: 30000, // Testing 3%

    // Scenario 1: "Optimistic" (Current Default)
    // Avg CAGR ~20%, Avg Vol ~30%

    // Scenario 2: "User's Reality" (High Vol, Modest Growth)
    // CAGR: Let's assume 15% flat (Long term 2-3x stock market)
    // Vol: 60% flat (The "Wild West")

    C_CAGR_START: 0.15, C_CAGR_END: 0.15,
    C_VOL_START: 0.60, C_VOL_END: 0.60,

    // Unused
    S_CAGR_START: 0.1, S_CAGR_END: 0.1, S_VOL_START: 0.2, S_VOL_END: 0.2,
    B_CAGR_START: 0.05, B_VOL_START: 0.05, INFL_MEAN: 0.03, INFL_VOL: 0.01,
    CORR_START: 0.2, CORR_END: 0.2,
    FLOOR_MULT: 0, CEILING_EARLY: 1000, CEILING_LATE: 1000, RANDOM_SEED: 123
};

function testRate(rate, note) {
    console.log(`Testing ${rate * 100}% Withdrawal (${note})...`);
    stressConfig.TARGET_ANNUAL_EXP = 1000000 * rate;
    const res = simulatePortfolio(rate, generateMarketData(stressConfig.numSims, stressConfig.years, stressConfig), stressConfig);
    console.log(`  => Success Rate: ${(res.successRate * 100).toFixed(1)}%`);
    return res.successRate;
}

console.log("Scenario: 15% Annual Growth, 60% Volatility (High Stress)");
testRate(0.06, "Simulator's previous output");
testRate(0.04, "Standard Rule");
testRate(0.03, "Expert Crypto Recommendation");
testRate(0.02, "Conservative Expert Rec");

// Math Check
// GeoMean = 0.15 - (0.6^2 / 2) = 0.15 - 0.18 = -3% ??? 
// Wait, arithmetic approximation breaks down at high vol.
// Real GeoMean = exp(ln(1.15) - 0.5 * 0.6^2) - 1 ? 
// Let's rely on the simulation result.

console.log("\nInterpretation:");
console.log("If 6% fails here, it proves the simulator IS sensitive to risk.");
console.log("The difference comes simply from the Growth Input (32% vs 15%) and Vol Input (40% vs 60%).");
