const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

// Setup Sandbox
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

const jsDir = path.join(__dirname, '../js');
const loadFile = (filePath) => {
    const code = fs.readFileSync(path.join(jsDir, filePath), 'utf8');
    vm.runInContext(code, sandbox);
};

console.log("Loading modules...");
loadFile('utils/config.js');
loadFile('engine/stats.js');
loadFile('engine/market.js');

const { generateMarketData } = sandbox.window;

async function runTest() {
    console.log("Testing START_IN_BEAR_MARKET configuration...");

    // Default config starts in Bull
    const configsDefault = {
        numSims: 100,
        years: 4,
        USE_FAT_TAILS: true,
        C_CAGR_START: 1.0,
        BEAR_MARKET_DEPTH: -0.75,
        START_IN_BEAR_MARKET: false
    };

    // Bear start config
    const configsBear = {
        ...configsDefault,
        START_IN_BEAR_MARKET: true
    };

    const dataDefault = await generateMarketData(100, 4, configsDefault);
    const dataBear = await generateMarketData(100, 4, configsBear);

    // Calculate average return for the first 12 months
    // For default (Bull), Months 0-11 should be strongly positive.
    // For Bear start, it shifts cycleOffset by 18, so Month 0 is Cycle Month 18.
    // Cycle Months 18-29 are the Bear Phase.
    // Therefore, the first 12 months for `configsBear` are exacty the 12-month Bear Phase.
    let sumDef = 0;
    let sumBear = 0;
    for (let s = 0; s < 100; s++) {
        for (let m = 0; m < 12; m++) {
            const idx = s * 48 + m; // 48 is total months
            sumDef += dataDefault.crypto[idx];
            sumBear += dataBear.crypto[idx];
        }
    }

    const avgFirstYearDef = sumDef / (100 * 12);
    const avgFirstYearBear = sumBear / (100 * 12);

    console.log(`Average First-Year Monthly Crypto Return (Default Bull Start): ${(avgFirstYearDef * 100).toFixed(2)}%`);
    console.log(`Average First-Year Monthly Crypto Return (Bear Start): ${(avgFirstYearBear * 100).toFixed(2)}%`);

    assert(avgFirstYearDef > 0, "Default config should start in a bull market with positive drift");
    assert(avgFirstYearBear < 0, "Bear start config should start in a bear market with negative drift");

    console.log("✅ START_IN_BEAR_MARKET logic is correctly wired up and dynamically shifts the 4-year cycle.");
}

runTest().catch(console.error);
