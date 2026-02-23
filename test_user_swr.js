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

async function investigate() {
    const config = {
        years: 30,
        INVESTED_AMOUNT: 6000000,
        CASH_BUFFER: 0,
        TARGET_ANNUAL_EXP: 60000,
        ALLOC_STOCKS: 0.0,
        ALLOC_BONDS: 0.0,
        ALLOC_CRYPTO: 1.0,
        TARGET_SUCCESS_PERCENT: 90,
        numSims: 1000,

        USE_FAT_TAILS: true,
        LIMIT_FAT_TAILS_10Y: false, // Try with normal
        START_IN_BEAR_MARKET: false,

        S_CAGR_START: 0.08, S_CAGR_END: 0.08,
        B_CAGR_START: 0.045, B_CAGR_END: 0.045,
        C_CAGR_START: 0.35, C_CAGR_END: 0.35,

        S_VOL_START: 0.17, S_VOL_END: 0.17,
        B_VOL_START: 0.06, B_VOL_END: 0.06,
        C_VOL_START: 0.40, C_VOL_END: 0.40,

        INFL_MEAN: 0.025, INFL_VOL: 0.0,
        BEAR_MARKET_DEPTH: -0.75
    };

    console.log("Generating Market Data...");
    const market = await generateMarketData(config.numSims, config.years, config);

    console.log("Running findSWR...");
    const swr = await findSWR(config.TARGET_SUCCESS_PERCENT / 100, market, config);
    console.log(`Optimized SWR: ${(swr * 100).toFixed(2)}%`);

    const res = simulatePortfolio(-1, market, config);
    console.log(`Console output SWR check for 60k/6M log: ${((config.TARGET_ANNUAL_EXP / config.INVESTED_AMOUNT) * 100).toFixed(2)}%`);

    // Let's also check if start in bear market is what ruined it
    config.START_IN_BEAR_MARKET = true;
    const marketBear = await generateMarketData(config.numSims, config.years, config);
    const swrBear = await findSWR(config.TARGET_SUCCESS_PERCENT / 100, marketBear, config);
    console.log(`Optimized SWR (Start in Bear): ${(swrBear * 100).toFixed(2)}%`);

    // Let's also check if 10y limit ruined it
    config.START_IN_BEAR_MARKET = false;
    config.LIMIT_FAT_TAILS_10Y = true;
    const market10y = await generateMarketData(config.numSims, config.years, config);
    const swr10y = await findSWR(config.TARGET_SUCCESS_PERCENT / 100, market10y, config);
    console.log(`Optimized SWR (10Y Limit): ${(swr10y * 100).toFixed(2)}%`);
}

investigate().catch(console.error);
