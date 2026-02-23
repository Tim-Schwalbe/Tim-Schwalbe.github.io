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

const { generateMarketData, findSWR } = sandbox.window;

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
        LIMIT_FAT_TAILS_10Y: false,
        START_IN_BEAR_MARKET: true,

        S_CAGR_START: 0.08, S_CAGR_END: 0.08,
        B_CAGR_START: 0.045, B_CAGR_END: 0.045,
        C_CAGR_START: 0.35, C_CAGR_END: 0.35,

        S_VOL_START: 0.17, S_VOL_END: 0.17,
        B_VOL_START: 0.06, B_VOL_END: 0.06,
        C_VOL_START: 0.40, C_VOL_END: 0.40,

        INFL_MEAN: 0.025, INFL_VOL: 0.0,
        BEAR_MARKET_DEPTH: -0.75
    };

    const market = await generateMarketData(config.numSims, config.years, config);
    const swr1 = await findSWR(0.90, market, config);
    console.log(`0 Year Cash Buffer SWR (Start Bear): ${(swr1 * 100).toFixed(2)}%`);

    config.CASH_BUFFER = 2; // 2 years
    const swr2 = await findSWR(0.90, market, config);
    console.log(`2 Year Cash Buffer SWR (Start Bear): ${(swr2 * 100).toFixed(2)}%`);

    config.CASH_BUFFER = 4; // 4 years
    const swr3 = await findSWR(0.90, market, config);
    console.log(`4 Year Cash Buffer SWR (Start Bear): ${(swr3 * 100).toFixed(2)}%`);
}

investigate().catch(console.error);
