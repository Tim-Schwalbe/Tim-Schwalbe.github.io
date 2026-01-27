
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

const generateMarketData = sandbox.window.generateMarketData;
const simulatePortfolio = sandbox.window.simulatePortfolio;

console.log("🏁 FINAL TRINITY COMPLIANCE AUDIT\n");

const TrinityConfig = {
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
    RANDOM_SEED: 123
};

// Test Case 1: Pure Trinity (No guardrails passed)
console.log("Test 1: Pure Trinity Protocol (Inflation Adjustment Active)");
const res1 = simulatePortfolio(-1, generateMarketData(1000, 30, TrinityConfig), TrinityConfig);
console.log(`  => Success Rate: ${(res1.successRate * 100).toFixed(1)}% (Expected: 92-95%)\n`);

// Test Case 2: New Browser Defaults (Floor: 0.0, Ceiling: 1000%)
console.log("Test 2: New Browser Defaults (Floor 0.0, Ceiling 1000%)");
const browserConfig = {
    ...TrinityConfig,
    FLOOR_MULT: 0.0,
    CEILING_EARLY: 1000,
    CEILING_LATE: 1000
};
const res2 = simulatePortfolio(-1, generateMarketData(1000, 30, browserConfig), browserConfig);
console.log(`  => Success Rate: ${(res2.successRate * 100).toFixed(1)}% (Expected: Same as Test 1)\n`);

if (Math.abs(res1.successRate - res2.successRate) < 0.01) {
    console.log("✅ SUCCESS: Browser defaults now match Trinity compliance!");
} else {
    console.log("❌ FAIL: Browser defaults still deviate from Trinity logic.");
}
