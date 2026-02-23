const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

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
    console.log("Testing FORCE_CRASH configuration...");

    const crashDurationYears = 2; // Crash for 24 months
    const floorStocks = -0.05; // Max -5% return
    const floorBonds = -0.02;  // Max -2% return

    const configsCrash = {
        numSims: 100,
        years: 4,
        FORCE_CRASH: true,
        CRASH_DURATION: crashDurationYears,
        CRASH_FLOOR_STOCKS: floorStocks,
        CRASH_FLOOR_BONDS: floorBonds,

        // Push actual parameters way up so the ceiling is hit
        S_CAGR_START: 1.0,
        S_CAGR_END: 1.0,
        S_VOL_START: 0, // No vol, solid +100% year
        S_VOL_END: 0,
        B_CAGR_START: 1.0,
        B_VOL_START: 0,
        B_VOL_END: 0,
        C_CAGR_START: 1.0,
        C_CAGR_END: 1.0,
        C_VOL_START: 0,
        C_VOL_END: 0
    };

    const dataCrash = await generateMarketData(100, 4, configsCrash);

    let crashPhaseChecksPass = true;
    let postCrashPhaseChecksPass = true;

    for (let s = 0; s < 100; s++) {
        for (let m = 0; m < 48; m++) {
            const idx = s * 48 + m;
            const sRet = dataCrash.stocks[idx];
            const bRet = dataCrash.bonds[idx];

            if (m < crashDurationYears * 12) {
                // Should hit the floor strictly because natural drift is +100%
                if (Math.abs(sRet - floorStocks) > 0.0001) crashPhaseChecksPass = false;
                if (Math.abs(bRet - floorBonds) > 0.0001) crashPhaseChecksPass = false;
            } else {
                // Post-crash, natural drift should resume
                if (sRet <= floorStocks) {
                    console.log(`Failed post-crash sRet at m=${m}: ${sRet}`);
                    postCrashPhaseChecksPass = false;
                }
                if (bRet <= floorBonds) {
                    console.log(`Failed post-crash bRet at m=${m}: ${bRet}`);
                    postCrashPhaseChecksPass = false;
                }
            }
        }
    }

    assert(crashPhaseChecksPass, "During the crash phase, returns must be strictly capped by the configured floors.");
    assert(postCrashPhaseChecksPass, "After the crash phase ends, returns must resume natural behavior.");

    console.log("✅ FORCE_CRASH logic is correctly wired up and caps returns appropriately.");
}

runTest().catch(console.error);
