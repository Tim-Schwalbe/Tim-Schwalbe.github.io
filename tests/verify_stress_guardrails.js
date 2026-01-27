
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

console.log("🔒 GUARD RAILS & STRESS TEST VERIFICATION 🔒\n");

let passed = 0;
let total = 0;

function assert(condition, message) {
    total++;
    if (condition) {
        console.log(`   ✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`   ❌ FAIL: ${message}`);
    }
}

// 1. VERIFY FORCE CRASH
console.log("\n--- TEST 1: Force Crash (3 Years) ---");
const crashConfigs = {
    FORCE_CRASH: true,
    CRASH_DURATION: 3,
    RANDOM_SEED: 12345, // Fixed seed for reproducibility
    S_CAGR_START: 0.10, S_CAGR_END: 0.10, S_VOL_START: 0.20, S_VOL_END: 0.20,
    C_CAGR_START: 0.15, C_CAGR_END: 0.15, C_VOL_START: 0.60, C_VOL_END: 0.60,
    B_CAGR_START: 0.05, B_VOL_START: 0.06,
    INFL_MEAN: 0.03, INFL_VOL: 0.01,
    CORR_START: 0.2, CORR_END: 0.2
};

const marketDataCrash = generateMarketData(10, 10, crashConfigs);
const { stocks, crypto, bonds } = marketDataCrash;

let crashWorked = true;
// Check first 3 years (36 months)
for (let i = 0; i < 36; i++) {
    // Logic: if returns were generated as positive, they should have been flipped to negative
    // but we can't see the original. However, expected behavior is "forced negative"?
    // Actually looking at code: if (ret > 0) ret = -abs(ret) * multiplier.
    // So NO positive returns should exist in the first 36 months.
    if (stocks[i] > 0 || crypto[i] > 0 || bonds[i] > 0) {
        crashWorked = false;
        console.error(`Found positive return at month ${i}: Stocks ${stocks[i]}, Crypto ${crypto[i]}, Bond ${bonds[i]}`);
        break;
    }
}
assert(crashWorked, "First 3 years have NO positive returns (Force Crash active)");

// Check year 4 (months 36-47) - should allow positive returns
let normalReturnsFound = false;
for (let i = 36; i < 48; i++) {
    if (stocks[i] > 0 || crypto[i] > 0 || bonds[i] > 0) {
        normalReturnsFound = true;
        break;
    }
}
assert(normalReturnsFound, "Year 4 returning to normal (positive returns found)");


// 2. VERIFY SPENDING CEILING (Guard Rail)
console.log("\n--- TEST 2: Spending Ceiling (Guard Rail) ---");
// Config: High inflation to drive up nominal spend, but LOW ceiling
const ceilingConfigs = {
    numSims: 1,
    years: 5,
    INVESTED_AMOUNT: 1000000,
    CASH_BUFFER: 0,
    TARGET_ANNUAL_EXP: 40000,
    ALLOC_STOCKS: 1.0, ALLOC_CRYPTO: 0, ALLOC_BONDS: 0,

    // Guard Rails
    CEILING_EARLY: 110, // Max 110% of initial withdrawal (nominal)
    CEILING_LATE: 110,

    // Market: High inflation will try to push withdrawal up 10% each year
    INFL_MEAN: 0.10, INFL_VOL: 0.0,
    SILENT: true
};

const marketDataCeiling = generateMarketData(1, 10, ceilingConfigs);
// Force inflation to be exactly 10% per year for cleaner math in test?
// Actually simpler: Run simulation and inspect logic.
// We can't easily inspect internal 'currentAnnualWithdrawal' variable without logging or modifying code.
// Workaround: We can infer checking if 'final wealth' matches expected valid path, 
// OR we rely on the logic check we read in simulator.js.
// BETTER: Modify simulator.js temporarily? No, standard is black box.
// Let's rely on the Logic Unit Test in your mind? No, user wants verification.
// I will create a synthetic market data where inflation is HUGE (50%).
// Without ceiling, year 2 withdrawal would be +50%. With ceiling 110%, it should be capped at +10%.

// Forced high inflation path
for (let i = 0; i < 60; i++) marketDataCeiling.inflation[i] = 0.50; // 50% monthly inflation?! No, annualized in formula?
// Formula: accumulatedInflation12m *= (1 + inflM)
// Wait, inflM in generateMarketData is annualized or monthly?
// market.js line 43: inflM = (MEAN / 12) + ...
// So it's monthly. 
// let's set monthly inflation to 0.04 (approx 60% annual)
for (let i = 0; i < 120; i++) {
    marketDataCeiling.inflation[i] = 0.04;
    marketDataCeiling.stocks[i] = 0.10; // High growth to prevent failure
}

const resCeiling = simulatePortfolio(-1, marketDataCeiling, ceilingConfigs);
// We can't see the withdrawal amount directly in the output 'res'. 'wealths' is final portfolio.
// However, we know: Portfolio[t] = Portfolio[t-1] * Growth - Withdrawal[t]
// This is hard to reverse engineer precisely.

// TRUST BUT VERIFY: I will enable a temporary console log in simulator.js for this test run?? 
// OR I can use the existing 'logSimulationSummary'? No it only logs initial.
// OK, looking at simulator line 86:
// const ceilingMult = (Math.floor((m + 1) / 12) < 10 ? configs.CEILING_EARLY : configs.CEILING_LATE) / 100;
// const capVal = initialAnnualWithdrawal * ceilingMult;
// currentAnnualWithdrawal = Math.min(capVal, currentAnnualWithdrawal)

// I will define a helper that acts as a unit test for the logic itself by recreating it here?
// No, that tests my test, not the code.

// STRATEGY update: 
// I will use `vm` to inject a spy function or modification? No too complex.
// I will rely on the fact that if ceiling works, wealth will be HIGHER than if it didn't.
// Scenario A: Ceiling 1000% (effectively none). High inflation -> High withdrawal -> Lower Wealth.
// Scenario B: Ceiling 110%. High inflation -> Capped withdrawal -> Higher Wealth.

const configNoCeiling = { ...ceilingConfigs, CEILING_EARLY: 10000 };
const resNoCeiling = simulatePortfolio(-1, marketDataCeiling, configNoCeiling);
const wealthUncapped = resNoCeiling.wealths[0];

const resWithCeiling = simulatePortfolio(-1, marketDataCeiling, ceilingConfigs);
const wealthCapped = resWithCeiling.wealths[0];

console.log(`   Wealth Uncapped: $${(wealthUncapped / 1000).toFixed(0)}k`);
console.log(`   Wealth Capped:   $${(wealthCapped / 1000).toFixed(0)}k`);

assert(wealthCapped > wealthUncapped, "Ceiling logic preserved capital (Capped Spend < Uncapped Spend)");
assert(wealthCapped > 0, "Portfolio survived");


// 3. VERIFY SPENDING FLOOR (Guard Rail)
console.log("\n--- TEST 3: Spending Floor (Guard Rail) ---");
// Scenario: Deflation (negative inflation) forces spending DOWN.
// Floor should keep it UP. 
// Or simply: Logic says currentAnnualWithdrawal *= accumulatedInflation
// If inflation is negative, spending drops.
// We want to force spending to stay at least FLOOR_MULT * Initial.

const floorConfigs = {
    numSims: 1,
    years: 5,
    INVESTED_AMOUNT: 1000000,
    CASH_BUFFER: 0,
    TARGET_ANNUAL_EXP: 40000,
    ALLOC_STOCKS: 1.0, ALLOC_CRYPTO: 0, ALLOC_BONDS: 0,

    // Guard Rails
    FLOOR_MULT: 1.0, // Floor = 100% of initial. Never drop below starting spend.

    // Market: Deflationary environment (-20%)
    INFL_MEAN: -0.20, INFL_VOL: 0.0,
    SILENT: true
};

const marketDataFloor = generateMarketData(1, 10, floorConfigs);
for (let i = 0; i < 120; i++) {
    marketDataFloor.inflation[i] = -0.02; // Negative monthly inflation
    marketDataFloor.stocks[i] = 0.0; // Flat market
}

// Case A: No Floor (Floor = 0). Spending drops with deflation. Wealth stays higher (saving money).
const configNoFloor = { ...floorConfigs, FLOOR_MULT: 0.0 };
const resNoFloor = simulatePortfolio(-1, marketDataFloor, configNoFloor);
const wealthNoFloor = resNoFloor.wealths[0];

// Case B: With Floor (Floor = 1.0). Spending forced to stay high. Wealth drops more.
const resWithFloor = simulatePortfolio(-1, marketDataFloor, floorConfigs);
const wealthWithFloor = resWithFloor.wealths[0];

console.log(`   Wealth No Floor (Spending drops): $${(wealthNoFloor / 1000).toFixed(0)}k`);
console.log(`   Wealth With Floor (Spending maintained): $${(wealthWithFloor / 1000).toFixed(0)}k`);

assert(wealthWithFloor < wealthNoFloor, "Floor logic forced higher spending (Floor Wealth < No Floor Wealth)");


// FINAL
console.log(`\nDONE: ${passed}/${total} Passed`);
if (passed === total) {
    console.log("✅ CONFIRMED: Stress Tests and Guard Rails are functionally active.");
} else {
    console.log("❌ WARNING: Some checks failed.");
    process.exit(1);
}
