
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// --- SETUP SANDBOX ---
const sandbox = {
    window: {},
    document: { getElementById: () => ({}) },
    console: console,
    Math: Math,
    parseFloat: parseFloat,
    parseInt: parseInt,
    Float64Array: Float64Array
};
sandbox.window = sandbox;
vm.createContext(sandbox);

// --- LOAD DEPENDENCIES ---
const jsDir = path.join(__dirname, '../js');
function load(p) {
    const code = fs.readFileSync(path.join(jsDir, p), 'utf8');
    vm.runInContext(code, sandbox);
}

load('utils/config.js');
load('engine/stats.js');
load('engine/market.js');
load('engine/simulator.js');
load('engine/swr.js');

const generateMarketData = sandbox.window.generateMarketData;
const findSWR = sandbox.window.findSWR;

console.log("🚀 SWR SENSITIVITY CHECK 🚀\n");

// BASE CONFIG
const baseConfig = {
    numSims: 1000, // Enough for statistical significance
    years: 30,
    INVESTED_AMOUNT: 1000000,
    CASH_BUFFER: 0,
    ALLOC_STOCKS: 0.80, ALLOC_CRYPTO: 0, ALLOC_BONDS: 0.20,
    TARGET_SUCCESS_PERCENT: 95,
    INFL_MEAN: 0.03, INFL_VOL: 0.015,
    SILENT: true
};

const marketData = generateMarketData(baseConfig.numSims, baseConfig.years, baseConfig);

// RUN 1: LOW CEILING (100% - Conservative)
const configLow = { ...baseConfig, CEILING_EARLY: 100, CEILING_LATE: 100 };
const swrLow = findSWR(0.95, marketData, configLow);

// RUN 2: HIGH CEILING (200% - Aggressive Upside)
const configHigh = { ...baseConfig, CEILING_EARLY: 200, CEILING_LATE: 200 };
const swrHigh = findSWR(0.95, marketData, configHigh);

console.log(`   SWR (Ceiling 100%): ${(swrLow * 100).toFixed(2)}%`);
console.log(`   SWR (Ceiling 200%): ${(swrHigh * 100).toFixed(2)}%`);

const diff = swrLow - swrHigh;
console.log(`   Difference: ${(diff * 100).toFixed(2)}%`);

// Logic: Aggressive spending (High Ceiling) should RISK survival more than Conservative spending.
// So High Ceiling SWR should be <= Low Ceiling SWR.
// Specifically, if you spend gains, you have less buffer.
// BUT, SWR is finding the *Initial* rate.
// If you start at 4%, and market goes UP, you spend MORE.
// If market crashes later, you have less money than if you saved.
// So survival rate drops.
// To compensate and reach 95% survival, you must START LOWER.
// So swrHigh should be LOWER than swrLow.

if (swrLow >= swrHigh) {
    if (diff > 0.0005) { // Measurable difference
        console.log("   ✅ SWR impacted correctly (Higher Spending = Lower SWR).");
    } else {
        console.log("   ⚠️ SWR identical. Maybe market scenario didn't trigger upside risks?");
        // This can happen if 95% failure cases are strictly start-sequence failures where Upside never triggers.
        // Upside only triggers in GOOD markets. Failures happen in BAD markets.
        // If a scenario fails, it's usually because it was BAD from the start.
        // If it was BAD, Portfolio < Initial.
        // If Portfolio < Initial, Uncapped Variable Spend < Floor.
        // So Floor applies constant.
        // So Ceiling is IRRELEVANT in failing scenarios!

        console.log("   ANALYSIS: Ceiling affects UPSIDE (Success cases). SWR depends on DOWNSIDE (Failure cases).");
        console.log("   In a failing path, Portfolio drops -> Spending hits Floor.");
        console.log("   Ceiling only limits spending when Portfolio > Initial.");
        console.log("   Therefore, raising Ceiling doesn't hurt survival in ALREADY BAD paths.");
        console.log("   It only hurts survival in 'Boom then Bust' paths.");
    }
} else {
    console.error("   ❌ FAIL: SWR High > SWR Low? This implies spending MORE makes you SAFER?");
}
