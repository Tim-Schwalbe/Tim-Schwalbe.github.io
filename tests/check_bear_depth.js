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
    console.log("Testing BEAR_MARKET_DEPTH configuration...");

    // Test parameters
    const cagr = 1.0; // 100% target average CAGR to make the peaks/troughs pronounced
    const configsDefault = {
        numSims: 100,
        years: 4, // Exactly one cycle 
        USE_FAT_TAILS: true,
        C_CAGR_START: cagr,
        C_CAGR_END: cagr,
        // Default bear depth is used implicitly if we don't pass it, but let's compare two explicit depths
        BEAR_MARKET_DEPTH: -0.75
    };

    const configsDeep = {
        ...configsDefault,
        BEAR_MARKET_DEPTH: -0.95
    };

    const dataDefault = await generateMarketData(100, 4, configsDefault);
    const dataDeep = await generateMarketData(100, 4, configsDeep);

    // Calculate average return during the Bear Market phase (Months 18-29)
    // Month 18 to 29 is 12 months.
    let sumDef = 0;
    let sumDeep = 0;
    const months = 12;
    for (let s = 0; s < 100; s++) {
        for (let m = 18; m < 30; m++) {
            const idx = s * 48 + m;
            sumDef += dataDefault.crypto[idx];
            sumDeep += dataDeep.crypto[idx];
        }
    }

    const avgMonthlyRetDef = sumDef / (100 * months);
    const avgMonthlyRetDeep = sumDeep / (100 * months);

    console.log(`Average Monthly Crypto Return (Bear Phase -75%): ${(avgMonthlyRetDef * 100).toFixed(2)}%`);
    console.log(`Average Monthly Crypto Return (Bear Phase -95%): ${(avgMonthlyRetDeep * 100).toFixed(2)}%`);

    // The drift for a -95% drop should be significantly lower (more negative) than a -75% drop.
    assert(avgMonthlyRetDeep < avgMonthlyRetDef, "A -95% bear depth must have a lower return than a -75% bear depth");

    // Also verify phase 1 (bull phase) drift is identical since BEAR_MARKET_DEPTH should only impact the bear/recovery phases mathematically
    // Wait, the peakMult is the same. But troughMult changes.
    // Bull phase (Months 0-17) depends ONLY on peakMult, which only depends on cycleMultiplier (target CAGR).
    let sumBullDef = 0;
    let sumBullDeep = 0;
    for (let s = 0; s < 100; s++) {
        for (let m = 0; m < 18; m++) {
            const idx = s * 48 + m;
            sumBullDef += dataDefault.crypto[idx];
            sumBullDeep += dataDeep.crypto[idx];
        }
    }
    const avgBullDef = sumBullDef / (100 * 18);
    const avgBullDeep = sumBullDeep / (100 * 18);

    console.log(`Average Bull Return (Def): ${(avgBullDef * 100).toFixed(2)}%, (Deep): ${(avgBullDeep * 100).toFixed(2)}%`);

    // Variance from random numbers makes them slightly different, but the expected drift is identical, so they should be very close
    assert(Math.abs(avgBullDef - avgBullDeep) < 0.20, "Bull phase returns should remain comparable regardless of bear depth");

    console.log("✅ BEAR_MARKET_DEPTH logic is correctly wired up and affects generated market returns.");
}

runTest().catch(console.error);
