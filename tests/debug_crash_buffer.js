const fs = require('fs');
const path = require('path');

// Mock browser environment
const window = {
    crypto: {
        getRandomValues: (buffer) => require('crypto').randomFillSync(buffer)
    }
};
global.window = window;

const enginePath = path.join(__dirname, '../js/engine.js');
const statisticsPath = path.join(__dirname, '../js/statistics.js');
const engineCode = fs.readFileSync(enginePath, 'utf8');

global.Stats = require(statisticsPath);
eval(engineCode);

console.log("=".repeat(80));
console.log("🕵️ DEBUG: FORCE CRASH + CASH BUFFER");
console.log("=".repeat(80));

const configs = {
    numSims: 1,
    years: 5, // Short debug
    INVESTED_AMOUNT: 1500000,
    CASH_BUFFER: 120000, // 2 Years of spend

    ALLOC_STOCKS: 0.0, ALLOC_CRYPTO: 1.0, ALLOC_BONDS: 0.0,
    TARGET_ANNUAL_EXP: 60000,

    // User's Crypto Params
    C_CAGR_START: 0.32, C_CAGR_END: 0.08,
    C_VOL_START: 0.40, C_VOL_END: 0.20,
    INFL_MEAN: 0.031, INFL_VOL: 0.015,

    // THE ISSUE:
    FORCE_CRASH: true,
    CRASH_DURATION: 1, // 1 Year Crash

    // Ensure this doesn't interfere
    MAX_CONSECUTIVE_BAD_YEARS: 100
};

// We need to inject a logger into simulatePortfolio to see month-by-month
// OR we just use the engine logic partially here?
// Better: We rely on generating market data and then running simulatePortfolio, 
// BUT we can't easily hook into the internal loop of simulatePortfolio without editing engine.js.
// 
// Alternative: Edit engine.js TEMPORARILY to log? 
// Or just replicate the logic? Replicating logic is dangerous (might differ).

// Let's use the 'generateMarketData' to see how BAD the crash is first.
console.log("Generating Market Data...");
const marketData = generateMarketData(configs.numSims, configs.years, configs);

console.log("\n📉 Analyzing Crash Severity (Year 1):");
let startVal = 10000;
let endVal = startVal;
for (let m = 0; m < 12; m++) {
    const ret = marketData.crypto[m];
    endVal *= Math.exp(ret);
    console.log(` Month ${m}: Ret ${(ret * 100).toFixed(2)}% | Val ${endVal.toFixed(2)}`);
}
const drop = (endVal - startVal) / startVal;
console.log(`\nTOTAL CRASH DROP: ${(drop * 100).toFixed(2)}%`);

// Now let's try to verify if simulatePortfolio uses the buffer.
// We can't see inside, but we can verify the FINAL WEALTH.
// If the drop is -80%, then $1.5M -> $300k.
// Buffer preserves $120k spending.
// If market recovers eventually... what does the wealth look like?

const res = simulatePortfolio(-1, marketData, configs);
console.log(`\nFinal Wealth: $${(res.wealths[0] / 1000000).toFixed(2)}M`);
console.log(`Success Rate: ${res.successRate * 100}%`);

if (drop < -0.60) {
    console.log("\n⚠️ HYPOTHESIS: The crash is too DEEP.");
    console.log("   Even if you don't sell, your asset value collapses by >60%.");
    console.log("   Sequence of Returns Risk: A 60% drop requires a 150% gain to break even.");
    console.log("   The 'Safety Buffer' saves you from selling low, but doesn't save the principal from evaporating.");
}
if (res.wealths[0] === 0) {
    console.log("⚠️ RESULT: Portfolio Failed.");
} else {
    console.log("✅ RESULT: Portfolio Survived.");
}
