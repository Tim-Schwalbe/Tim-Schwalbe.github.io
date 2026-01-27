
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

console.log("🚀 WEALTH IMPACT CHECK 🚀\n");

// BASE CONFIG
const baseConfig = {
    numSims: 1000,
    years: 30,
    INVESTED_AMOUNT: 1000000,
    CASH_BUFFER: 0,
    TARGET_ANNUAL_EXP: 40000, // 4% Rule
    ALLOC_STOCKS: 1.0, ALLOC_CRYPTO: 0, ALLOC_BONDS: 0.0, // 100% Stocks for max growth
    INFL_MEAN: 0.03, INFL_VOL: 0.0, // Steady inflation
    SILENT: true
};

// Use same market data for fair comparison
const marketData = generateMarketData(baseConfig.numSims, baseConfig.years, baseConfig);

// RUN 1: CEILING 150% (Normal Cap)
const configNormal = { ...baseConfig, CEILING_EARLY: 150, CEILING_LATE: 150 };
const resNormal = simulatePortfolio(-1, marketData, configNormal);
const wealthsNormal = resNormal.wealths.sort((a, b) => a - b);
const medianNormal = wealthsNormal[500];

// RUN 2: CEILING 10000% (Uncapped Party Mode)
const configParty = { ...baseConfig, CEILING_EARLY: 10000, CEILING_LATE: 10000 };
const resParty = simulatePortfolio(-1, marketData, configParty);
const wealthsParty = resParty.wealths.sort((a, b) => a - b);
const medianParty = wealthsParty[500];

console.log(`   Median Wealth (Ceiling 150%):   $${(medianNormal / 1000).toFixed(0)}k`);
console.log(`   Median Wealth (Ceiling 10000%): $${(medianParty / 1000).toFixed(0)}k`);

const diff = medianNormal - medianParty;
console.log(`   Wealth Difference: $${(diff / 1000).toFixed(0)}k`);

if (diff > 100000) { // Should be huge difference (millions?)
    console.log("   ✅ PASS: High Ceiling drastically reduced Ending Wealth (Spending worked).");
} else {
    // If wealths are similar, it means logic FAILED to spend more.
    console.error("   ❌ FAIL: Wealth matches? Logic is ignoring the Ceiling parameter!");

    // DEBUG: Why?
    // Check if simulatePortfolio is seeing the config?
    // In simulator.js:
    // const ceilingPct = ( ... (configs.CEILING_EARLY || 150) ... ) / 100;
    // const maxCap = currentBaseNeed * ceilingPct;
    // currentAnnualWithdrawal = Math.max(currentBaseNeed, Math.min(variableSpend, maxCap));

    // Maybe `variableSpend` is too low?
    // const initialSWR = initialAnnualWithdrawal / (INVESTED_AMOUNT || 1);
    // 40k / 1M = 0.04.
    // If Stocks grow 7% real. Portfolio doubles in 10 yrs.
    // variableSpend = 2M * 0.04 = 80k.
    // currentBaseNeed = 40k * inflation.
    // So 80k > 40k. Upside MUST trigger.
}
