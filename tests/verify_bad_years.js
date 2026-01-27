const fs = require('fs');
const vm = require('vm');
const path = require('path');

// --- 1. SETUP SANDBOX ---
const sandbox = {
    window: {},
    document: { getElementById: () => ({}) }, // Mock document for minimal needs
    console: console,
    Math: Math,
    parseFloat: parseFloat,
    parseInt: parseInt,
    Float64Array: Float64Array
};
sandbox.window = sandbox;
vm.createContext(sandbox);

// --- 2. LOAD DEPENDENCIES ---
const jsDir = path.join(__dirname, '../js');
function load(p) {
    const code = fs.readFileSync(path.join(jsDir, p), 'utf8');
    vm.runInContext(code, sandbox);
}

load('utils/config.js');
load('engine/stats.js');
load('engine/market.js');
load('engine/simulator.js');

// --- 3. TEST PARAMETERS ---
const TEST_SEED = 12345;
const Config = sandbox.window.Config;
const Stats = sandbox.window.Stats;
const generateMarketData = sandbox.window.generateMarketData;
const simulatePortfolio = sandbox.window.simulatePortfolio;

const baseConfigs = {
    numSims: 1, // Deterministic single run
    years: 20,
    INVESTED_AMOUNT: 1000000,
    CASH_BUFFER: 0,
    TARGET_ANNUAL_EXP: 40000,

    // Crypto: Bearish to FORCE bad years
    C_CAGR_START: -0.20, C_CAGR_END: -0.20,
    C_VOL_START: 0.60, C_VOL_END: 0.60,
    INFL_MEAN: 0.03, INFL_VOL: 0.015,
    RANDOM_SEED: TEST_SEED,

    // Allocation: 100% Crypto to maximize volatility
    ALLOC_STOCKS: 0, ALLOC_BONDS: 0, ALLOC_CRYPTO: 1.0,

    // Weights
    wS: 0, wB: 0, wC: 1
};


// --- 4. ENGINE HELPERS ---
function analyzeMarketPath(marketData, years) {
    const cryptoReturns = marketData.crypto;
    const inflationPath = marketData.inflation;

    let badYears = 0;
    let maxStreak = 0;
    let currentStreak = 0;
    let forcedRecoveryYears = 0;

    for (let y = 0; y < years; y++) {
        let annualGrowth = 1.0;
        let annualInflation = 1.0;

        for (let k = 0; k < 12; k++) {
            const i = y * 12 + k;
            annualGrowth *= Math.exp(cryptoReturns[i]);
            annualInflation *= (1 + inflationPath[i]);
        }

        if (annualGrowth < annualInflation) {
            badYears++;
            currentStreak++;
        } else {
            currentStreak = 0;
        }
        if (currentStreak > maxStreak) maxStreak = currentStreak;
    }
    return { badYears, maxStreak };
}

function runScenario(name, limitBadYears) {
    console.log(`\n🔹 SCENARIO: ${name}`);
    const cfg = { ...baseConfigs, MAX_CONSECUTIVE_BAD_YEARS: limitBadYears };

    Stats.seed(TEST_SEED);

    console.log("   Debug: Generating Market Data...");
    const marketData = generateMarketData(cfg.numSims, cfg.years, cfg);
    console.log("   Debug: Market Data Generated.");

    const { badYears, maxStreak } = analyzeMarketPath(marketData, cfg.years);
    console.log(`   Genererated Path Analysis (Crypto):`);
    console.log(`   - Bad Years: ${badYears}/${cfg.years}`);
    console.log(`   - Max Streak: ${maxStreak} years`);

    console.log("   Debug: Running Simulation...");
    const res = simulatePortfolio(-1, marketData, cfg);
    console.log("   Debug: Simulation Complete.");

    console.log(`   Final Wealth: $${(res.wealths[0] / 1e6).toFixed(2)}M`);
    return { wealth: res.wealths[0], maxStreak: maxStreak };
}

// --- 5. EXECUTE ---
const resStandard = runScenario("Standard (Limit 2)", 2);
const resUser = runScenario("User (Limit 30)", 30);

console.log("\n\n📊 COMPARISON");
console.log(`Standard (Limit 2) Wealth: $${(resStandard.wealth / 1e6).toFixed(2)}M`);
console.log(`User (Limit 30) Wealth:    $${(resUser.wealth / 1e6).toFixed(2)}M`);

if (resStandard.maxStreak <= 3 && resUser.maxStreak > 5) {
    console.log("\n✅ VERIFIED: Generator enforced constraints.");
    if (resStandard.wealth > resUser.wealth) {
        console.log("✅ VERIFIED: Limit 2 is SAFER (Higher Wealth) than Limit 30.");
        console.log("   The Limit 2 portfolio forced market recoveries, preventing total collapse.");
        process.exit(0);
    } else {
        console.log("❌ FAIL: Wealth outcomes unexpected. Limit 2 should be safer.");
        process.exit(1);
    }
} else {
    console.log("❌ FAIL: Constraints not enforced as expected.");
    console.log(`   Standard Streak: ${resStandard.maxStreak} (Expected <= 3)`);
    console.log(`   User Streak:     ${resUser.maxStreak} (Expected > 5)`);
    process.exit(1);
}
