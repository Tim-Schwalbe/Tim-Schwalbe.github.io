
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

console.log("🚀 CEILING PERIODS VERIFICATION 🚀\n");

// CONFIG: Early = Strict (100%), Late = Loose (500%)
const config = {
    numSims: 1,
    years: 20,
    INVESTED_AMOUNT: 1000000,
    CASH_BUFFER: 0,
    TARGET_ANNUAL_EXP: 40000,
    ALLOC_STOCKS: 1.0,
    CEILING_EARLY: 100, // Capped at $40k
    CEILING_LATE: 500,  // Capped at $200k
    INFL_MEAN: 0.0,     // No inflation for clear math
    SILENT: true
};

// MARKET: Super Bull (+100% Year 1, then flat)
// This ensures Portfolio > Target triggers Upside Logic immediately.
const market = generateMarketData(1, 20, config);
for (let i = 0; i < 240; i++) {
    // 10% annual growth equivalent monthly
    market.stocks[i] = Math.log(1.10) / 12;
    market.inflation[i] = 0;
}

// RUN SIM
// We need to capture annual withdrawals. 
// modify simulatePortfolio to log? Or just trust the final wealth/logic?
// The simulator doesn't return annual stream by default in 'res'.
// However, we can infer it.
// Actually, let's just modify the simulator temporarily OR assume logic holds if Final Wealth is lower than 100/100 case?
// No, better to view the logic or trust the code if I just verified it.
// Wait, I can use "stats" if enabled? No.
// I will copy the logic in a mini-script here to verify the exact math if I can't hook into the function.
// OR, I can trust the `wealths` output.
// If Early Ceiling works: Wealth grows fast in Y1-10.
// If Late Ceiling works: Wealth drops fast in Y11-20.

const res = simulatePortfolio(-1, market, config);
const finalWealth = res.wealths[0];

// CALCULATE EXPECTED
// Y1-10: Portfolio grows 10% yr. Spend fixed 40k.
// 1M -> 1.1M - 40k = 1.06M ... compounded.
// Y11-20: Portfolio grows 10%. Spend Max(40k, Min(Portfolio*4%, 5*40k)).
// Portfolio*4% at >2M is >80k. So Spend > 40k.
// If spending increases, it confirms Late Ceiling worked.

console.log(`   Final Wealth: $${(finalWealth / 1000).toFixed(0)}k`);

// CONTROLS
const configStrict = { ...config, CEILING_LATE: 100 };
const resStrict = simulatePortfolio(-1, market, configStrict);
const finalWealthStrict = resStrict.wealths[0];

const configLoose = { ...config, CEILING_EARLY: 500 };
const resLoose = simulatePortfolio(-1, market, configLoose);
const finalWealthLoose = resLoose.wealths[0];

console.log(`   Strict/Strict Wealth: $${(finalWealthStrict / 1000).toFixed(0)}k`);
console.log(`   Loose/Loose Wealth:   $${(finalWealthLoose / 1000).toFixed(0)}k`);
console.log(`   Strict/Loose Wealth:  $${(finalWealth / 1000).toFixed(0)}k`);

// ASSERTIONS
// Mixed should be BETWEEN Strict and Loose.
// Strict/Loose means we Saved early (Rich), then Spent late (Poor).
// So Strict/Loose < Strict/Strict.
// And Strict/Loose > Loose/Loose (because we saved early).

if (finalWealth < finalWealthStrict && finalWealth > finalWealthLoose) {
    console.log("   ✅ PASS: Split Ceilings work correctly.");
    console.log("   (Saved money in Y1-10, spent it in Y11+).");
} else {
    console.error("   ❌ FAIL: Logic did not produce intermediate wealth.");
}
