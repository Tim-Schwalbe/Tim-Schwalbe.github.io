const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = {
    window: {},
    console: console,
    Math: Math,
    parseFloat: parseFloat,
    parseInt: parseInt,
    Float64Array: Float64Array,
    Array: Array,
    Object: Object,
    isNaN: isNaN,
    isFinite: isFinite,
    setTimeout: (cb) => { cb() },
    Promise: Promise
};
sandbox.window = sandbox;
vm.createContext(sandbox);

const jsDir = path.join(__dirname, 'js');
const loadFile = (filePath) => {
    const code = fs.readFileSync(path.join(jsDir, filePath), 'utf8');
    vm.runInContext(code, sandbox);
};

loadFile('utils/config.js');
loadFile('engine/stats.js');
loadFile('engine/market.js');
loadFile('engine/simulator.js');

const { generateMarketData, simulatePortfolio } = sandbox.window;

async function investigate() {
    const config = {
        years: 30,
        INVESTED_AMOUNT: 1500000,
        CASH_BUFFER: 0,
        TARGET_ANNUAL_EXP: 58500,
        ALLOC_STOCKS: 0.0,
        ALLOC_BONDS: 0.0,
        ALLOC_CRYPTO: 1.0,  // 100% Crypto
        TARGET_SUCCESS_PERCENT: 90,
        numSims: 1000,
        SILENT: true,

        USE_FAT_TAILS: true,
        LIMIT_FAT_TAILS_10Y: true,
        START_IN_BEAR_MARKET: true,   // from UI default!

        // THESE ARE THE EXACT UI DEFAULTS
        C_CAGR_START: 0.6536,
        C_CAGR_MID: 0.25,
        C_CAGR_END: 0.06,

        C_VOL_START: 0.70,
        C_VOL_MID: 0.40,
        C_VOL_END: 0.20,

        INFL_MEAN: 0.025, INFL_VOL: 0.015,
        BEAR_MARKET_DEPTH: -0.75
    };

    console.log("Generating Market Data...");
    const market = await generateMarketData(config.numSims, config.years, config);

    console.log("Running Simulation...");
    const res = simulatePortfolio(-1, market, config);
    console.log("Median Wealth:", res.stats.medianRealFinalWealth * res.wealths.reduce((a,b)=>a+b,0)*0 + res.stats.medianRealFinalWealth);
    // Print nominal median:
    const sorted = [...res.wealths].sort((a,b)=>a-b);
    console.log("Nominal Median:", sorted[Math.floor(sorted.length/2)]);
}

investigate().catch(console.error);
