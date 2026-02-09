
// Mock Config if not present
if (typeof Config === 'undefined') {
    global.Config = {
        getConfig: (configs, key, def) => {
            if (configs && configs[key] !== undefined) return configs[key];
            return def;
        }
    };
}

// Mock Stats if not present
if (typeof Stats === 'undefined') {
    global.Stats = {
        seed: () => { },
        random: Math.random, // Basic PRNG
        randomNormal: (mean, stdDev) => {
            let u = 0, v = 0;
            while (u === 0) u = Math.random();
            while (v === 0) v = Math.random();
            let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            return mean + (z * stdDev);
        }
    };
}

// Ensure market.js is loaded (we will cat it before running or require it)
// For simplicity, we assume market.js content is available or we redefine generateMarketData here used in market.js
// Actually, since we modified market.js on disk, we can just cat it and this test file together.

// Test Logic
function runTest() {
    const numSims = 100;
    const years = 30;
    const months = years * 12; // 360 months

    const baseConfig = {
        C_CAGR_START: 0.15, C_CAGR_END: 0.15,
        C_VOL_START: 0.60, C_VOL_END: 0.60,
        S_CAGR_START: 0.08, S_CAGR_END: 0.08, S_VOL_START: 0.17, S_VOL_END: 0.17,
        B_CAGR_START: 0.045, B_VOL_START: 0.06,
        INFL_MEAN: 0.025, INFL_VOL: 0.015,
        CORR_START: 0.2, CORR_END: 0.2
    };

    console.log("Running Normal Simulation...");
    const dataNormal = window.generateMarketData(numSims, years, { ...baseConfig, USE_FAT_TAILS: false });

    console.log("Running Fat Tail Simulation...");
    const dataFat = window.generateMarketData(numSims, years, { ...baseConfig, USE_FAT_TAILS: true });

    // Analyze Crypto Returns
    const normalMin = Math.min(...dataNormal.crypto);
    const fatMin = Math.min(...dataFat.crypto);

    // Convert Log Return to % Drop
    const normalDrop = (Math.exp(normalMin) - 1) * 100;
    const fatDrop = (Math.exp(fatMin) - 1) * 100;

    console.log(`Normal Worst Month: ${normalDrop.toFixed(2)}%`);
    console.log(`Fat Tail Worst Month: ${fatDrop.toFixed(2)}%`);

    if (fatDrop < normalDrop - 10) { // Expect at least 10% deeper crash
        console.log("✅ SUCCESS: Fat Tails produced significantly deeper crashes.");
    } else {
        console.error("❌ FAILURE: Fat Tails did not produce significantly deeper crashes.");
        console.error("Diff:", fatDrop - normalDrop);
    }
}

// Mock window
global.window = {};

// We rely on the market.js code being appended before this script runs.
if (window.generateMarketData) {
    runTest();
} else {
    console.log("Waiting for verify_fat_tails to run with market.js content...");
}
