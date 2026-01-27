
const Stats = require('../js/statistics.js');
global.Stats = Stats;
const { generateMarketData, simulatePortfolio } = require('../js/engine.js');

console.log("🔍 EXACT BROWSER SCENARIO TEST\n");

// EXACT scenario from user's screenshots
const browserScenario = {
    years: 30,
    numSims: 1000,
    INVESTED_AMOUNT: 1500000,  // User's capital
    CASH_BUFFER: 0,
    ALLOC_STOCKS: 0.50,
    ALLOC_CRYPTO: 0,
    TARGET_ANNUAL_EXP: 60000,  // User's target spend

    // Trinity parameters (verified from screenshots)  
    S_CAGR_START: 0.103, S_CAGR_END: 0.103,
    S_VOL_START: 0.20, S_VOL_END: 0.20,
    B_CAGR_START: 0.052, B_VOL_START: 0.06,
    INFL_MEAN: 0.031, INFL_VOL: 0.015,
    CORR_START: 0.20, CORR_END: 0.20
};

console.log("Parameters (from user's browser):");
console.log("  $1.5M capital, $60k/year spend (4.0% withdrawal)");
console.log("  50/50 Stocks/Bonds");
console.log("  Trinity defaults\n");

const data = generateMarketData(1000, 30, browserScenario);
const res = simulatePortfolio(-1, data, browserScenario);

console.log(`Result: ${(res.successRate * 100).toFixed(1)}% success\n`);

if (res.successRate > 0.97) {
    console.log("❌ MISMATCH!");
    console.log("Browser shows: 99.6%");
    console.log("Node.js shows: " + (res.successRate * 100).toFixed(1) + "%");
    console.log("\nThis means the browser is NOT using the updated JS files.");
    console.log("Try: Close browser completely, reopen, hard refresh.");
} else {
    console.log("✅ SUCCESS!");
    console.log("Node matches expected ~93-95% range.");
}
