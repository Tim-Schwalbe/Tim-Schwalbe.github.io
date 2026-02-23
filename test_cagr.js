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

const { generateMarketData } = sandbox.window;

async function testScenario() {
    const config = {
        years: 10,
        numSims: 1000,
        C_CAGR_START: 0.355,
        C_CAGR_END: 0.30,
        C_VOL_START: 0.75, // Default crypto vol
        C_VOL_END: 0.75,
        USE_FAT_TAILS: true,
        LIMIT_FAT_TAILS_10Y: true,
        BEAR_MARKET_DEPTH: -0.75
    };

    const marketData = await generateMarketData(config.numSims, config.years, config);

    // calcCAGR formula from main.js
    const calcCAGR = (logReturns) => {
        if (!logReturns || logReturns.length === 0) return 0;
        let sumLog = 0;
        for (let i = 0; i < logReturns.length; i++) {
            sumLog += logReturns[i];
        }
        const avgLogMonthly = sumLog / logReturns.length;
        return (Math.exp(avgLogMonthly * 12) - 1) * 100;
    };

    const rCrypto = calcCAGR(marketData.crypto);
    console.log(`Gen. Average Return for Crypto: ${rCrypto.toFixed(2)}%`);
}

testScenario().catch(console.error);
