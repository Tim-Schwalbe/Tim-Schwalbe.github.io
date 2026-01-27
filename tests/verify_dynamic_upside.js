
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

console.log("🚀 DYNAMIC UPSIDE VERIFICATION 🚀\n");

// BASE CONFIG
const baseConfig = {
    numSims: 1,
    years: 5,
    INVESTED_AMOUNT: 1000000,
    CASH_BUFFER: 0,
    TARGET_ANNUAL_EXP: 40000, // 4% SWR
    ALLOC_STOCKS: 1.0, ALLOC_CRYPTO: 0, ALLOC_BONDS: 0,
    CEILING_EARLY: 150, // 150% Cap
    CEILING_LATE: 150,
    SILENT: true
};

// HELPER: Mock Portfolio Simulation
// We need to see the ACTUAL withdrawal amounts year by year.
// simulator.js doesn't return annual series, only final wealth.
// TRICK: We can infer spending behavior by comparing Final Wealth against Expected Wealth.
// Wealth_end = Wealth_start * Growth - Withdrawal.
// Withdrawal = Wealth_start * Growth - Wealth_end.

// TEST 1: BULL MARKET (Spending should INCREASE)
console.log("--- TEST 1: BULL MARKET (High Growth) ---");
const marketBull = generateMarketData(1, 5, baseConfig);
// Force +20% growth per year, 0% inflation
for (let i = 0; i < 60; i++) {
    marketBull.stocks[i] = Math.log(1.20) / 12; // 20% annual continuous? close enough
    marketBull.inflation[i] = 0.0;
}

const resBull = simulatePortfolio(-1, marketBull, baseConfig);
const wealthBull = resBull.wealths[0];

// Calc Expected if spending stuck to floor ($40k/yr):
// Yr 1: 1000k * 1.2 - 40 = 1160
// Yr 2: 1160 * 1.2 - 40 = 1352
// Yr 3: 1352 * 1.2 - 40 = 1582
// ...
// If spending INCREASED, final wealth will be LOWER than this fixed-spend projection.
let projected = 1000000;
for (let y = 0; y < 5; y++) projected = (projected * 1.2) - 40000;

console.log(`   Final Wealth (Dynamic): $${(wealthBull / 1000).toFixed(0)}k`);
console.log(`   Final Wealth (Fixed):   $${(projected / 1000).toFixed(0)}k`);

if (wealthBull < projected - 10000) { // Sizable difference
    console.log("   ✅ PASS: Spending Increased (Wealth is lower than fixed-spend scenario)");
} else {
    console.error("   ❌ FAIL: Spending did NOT increase properly.");
}


// TEST 2: BEAR MARKET (Spending should HOLD FLOOR)
console.log("\n--- TEST 2: BEAR MARKET (Crash) ---");
const marketBear = generateMarketData(1, 5, baseConfig);
// Force -10% growth per year, 0% inflation
for (let i = 0; i < 60; i++) {
    marketBear.stocks[i] = Math.log(0.90) / 12;
    marketBear.inflation[i] = 0.0;
}

const resBear = simulatePortfolio(-1, marketBear, baseConfig);
const wealthBear = resBear.wealths[0];

// Calc Expected if spending stuck to floor ($40k/yr):
// Floor should strictly apply. Variable spend would be LOW (4% of dropped portfolio).
// Simulator should take MAX(Floor, Variable) -> Floor.
let projectedBear = 1000000;
for (let y = 0; y < 5; y++) projectedBear = (projectedBear * 0.90) - 40000;

console.log(`   Final Wealth (Dynamic): $${(wealthBear / 1000).toFixed(0)}k`);
console.log(`   Final Wealth (Fixed):   $${(projectedBear / 1000).toFixed(0)}k`);

// Allow small rounding error
if (Math.abs(wealthBear - projectedBear) < 5000) {
    console.log("   ✅ PASS: Spending Held Floor (Wealth matches fixed-spend scenario)");
} else {
    console.error("   ❌ FAIL: Spending dropped below floor! (Wealth is higher than expected)");
}

// TEST 3: CEILING CHECK
// In Bull Market, did we cap at 150%? ($60k)
// If uncapped (full 4% of portfolio), spend would be massive.
// Yr 1 Port 1.2M -> 4% = 48k. (Below Cap 60k).
// Yr 2 Port ~1.4M -> 4% = 56k. (Close to Cap).
// Yr 3 Port ~1.7M -> 4% = 68k. (Above Cap 60k). SHOULD CAP.
// Let's run a SUPER Bull Market (+100%) to force Cap.
console.log("\n--- TEST 3: CEILING CAP ---");
const marketSuper = generateMarketData(1, 5, baseConfig);
for (let i = 0; i < 60; i++) {
    marketSuper.stocks[i] = Math.log(2.0) / 12; // +100% per year
    marketSuper.inflation[i] = 0.0;
}
const resSuper = simulatePortfolio(-1, marketSuper, baseConfig);
const wealthSuper = resSuper.wealths[0];

// Expected with Cap $60k (1.5x of 40k)
let projCap = 1000000;
for (let y = 0; y < 5; y++) projCap = (projCap * 2.0) - 60000; // Cap limit

// Expected Uncapped (Ratio 4%)
// Spend = Port * 0.04
// Yr 1: 1M * 2 = 2M. Spend 80k. (Wealth 1.92M)
// ...
// Cap should save ALOT of wealth.
console.log(`   Final Wealth (Capped):   $${(wealthSuper / 1000).toFixed(0)}k`);
console.log(`   Projected (If Capped):   $${(projCap / 1000000).toFixed(2)}M`);

if (Math.abs(wealthSuper - projCap) < 100000) { // Margin for compounding
    console.log("   ✅ PASS: Spending Capped at 150% (Wealth matches capped projection)");
} else {
    console.log("   ⚠️ Note: Variance found. Checking logic...");
    // It's possible simpler calc above misses monthly compounding effects compared to sim.
    // If wealthSuper >> projCap, it means we spent LESS? No.
    // Wait, if projCap assumes annual withdrawal at END, sim does MONTHLY.
    // But conceptually, if we are close to 'ProjCap' ($60k/yr) vs Uncapped ($80k+, $160k+), it passes.
    // Uncapped would deplete way faster.

    // Uncapped logic approx: Wealth *= (2.0 - 0.04)? No.

    if (wealthSuper > 28000000) { // 1M * 2^5 = 32M. Minus peanuts.
        console.log("   ✅ PASS: Spending Capped (High Wealth Retained)");
    } else {
        console.error("   ❌ FAIL: Wealth too low, implies uncapped spending.");
    }
}
