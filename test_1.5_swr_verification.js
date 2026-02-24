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
    setTimeout: setTimeout,
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
loadFile('engine/swr.js');

const { generateMarketData, findSWR, simulatePortfolio } = sandbox.window;

async function runVerification() {
    const config = {
        years: 30,
        INVESTED_AMOUNT: 1000000,
        CASH_BUFFER: 0,
        TARGET_ANNUAL_EXP: 15000, // 1.5% of 1M
        ALLOC_STOCKS: 0.0,
        ALLOC_BONDS: 0.0,
        ALLOC_CRYPTO: 1.0,
        TARGET_SUCCESS_PERCENT: 90, // UI Default
        numSims: 1000,

        USE_FAT_TAILS: true, // 4-Year Cycle Model
        LIMIT_FAT_TAILS_10Y: true, // UI Default
        START_IN_BEAR_MARKET: true, // UI Default
        BEAR_MARKET_DEPTH: -0.75,

        S_CAGR_START: 0.08, S_CAGR_END: 0.08,
        B_CAGR_START: 0.045, B_CAGR_END: 0.045,
        C_CAGR_START: 0.4518, C_CAGR_END: 0.4518, // Recently updated default for Crypto

        S_VOL_START: 0.17, S_VOL_END: 0.17,
        B_VOL_START: 0.06, B_VOL_END: 0.06,
        C_VOL_START: 0.70, C_VOL_END: 0.70,

        INFL_MEAN: 0.025, INFL_VOL: 0.015,
        SILENT: true
    };

    console.log("Generating Market Data...");
    const market = await generateMarketData(config.numSims, config.years, config);

    console.log("Running findSWR (Target: 90%)...");
    // Find SWR based on UI defaults
    const swr = await findSWR(config.TARGET_SUCCESS_PERCENT / 100, market, config);
    console.log(`Optimized SWR: ${(swr * 100).toFixed(2)}%`);

    console.log("\nTesting explicitly with 1.5% withdrawal rate:");
    config.TARGET_ANNUAL_EXP = config.INVESTED_AMOUNT * 0.015;
    const res = await simulatePortfolio(-1, market, config);
    console.log(`Success Rate at 1.5% SWR: ${(res.successRate * 100).toFixed(1)}%`);

    // Test explicitly with 1.5% SWR again with no 10Y limit
    console.log("\nWhat if NO 10Y limit?:");
    config.LIMIT_FAT_TAILS_10Y = false;
    const market2 = await generateMarketData(config.numSims, config.years, config);
    const swr2 = await findSWR(config.TARGET_SUCCESS_PERCENT / 100, market2, config);
    console.log(`Optimized SWR (No 10Y Limit): ${(swr2 * 100).toFixed(2)}%`);
}

runVerification().catch(console.error);
