
const fs = require('fs');
const path = require('path');

// 1. Setup Environment Mocks
global.window = {};
global.Config = {
    getConfig: (configs, key, def) => {
        if (configs && configs[key] !== undefined) return configs[key];
        return def;
    }
};

global.Stats = {
    seed: () => { },
    _random: Math.random,
    random: function () { return this._random(); },
    randomNormal: (mean, stdDev) => {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return mean + (z * stdDev);
    }
};

// 2. Load Market Logic
const marketJsPath = path.join(__dirname, '../engine/market.js');
const marketJsContent = fs.readFileSync(marketJsPath, 'utf8');
eval(marketJsContent); // Execute in global scope

// 3. Run Test Logic
function runTest() {
    const numSims = 5000;
    const years = 30;

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

    console.log("Running Fat Tail Simulation (Negative Skew)...");
    const dataFat = window.generateMarketData(numSims, years, { ...baseConfig, USE_FAT_TAILS: true });

    // Verify Stats (Mean, Min, Skew)
    const getStats = (arr) => {
        const len = arr.length;
        let sum = 0;
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < len; i++) {
            sum += arr[i];
            if (arr[i] < min) min = arr[i];
            if (arr[i] > max) max = arr[i]; // Max log return
        }
        const mean = sum / len;

        let sumSqDiff = 0;
        for (let i = 0; i < len; i++) sumSqDiff += Math.pow(arr[i] - mean, 2);
        const variance = sumSqDiff / (len - 1);
        const stdDev = Math.sqrt(variance);

        let sumCubedDiff = 0;
        for (let i = 0; i < len; i++) sumCubedDiff += Math.pow((arr[i] - mean) / stdDev, 3);
        const skew = sumCubedDiff / len;

        return { mean, min, max, skew };
    };

    const normalStats = getStats(dataNormal.crypto);
    const fatStats = getStats(dataFat.crypto);

    // Convert Log Min to % Drop
    const normalDrop = (Math.exp(normalStats.min) - 1) * 100;
    const fatDrop = (Math.exp(fatStats.min) - 1) * 100;

    console.log(`Normal:   Mean ${normalStats.mean.toFixed(5)}, Min Drop ${normalDrop.toFixed(2)}%, Skew ${normalStats.skew.toFixed(4)}`);
    console.log(`Fat Tail: Mean ${fatStats.mean.toFixed(5)}, Min Drop ${fatDrop.toFixed(2)}%, Skew ${fatStats.skew.toFixed(4)}`);

    // Criteria:
    // 1. Fat Tail Mean should be LOWER than Normal Mean (Negative Drag)
    // 2. Fat Tail Min Drop should be deeper
    // 3. Fat Tail Skew should be more negative
    if (fatStats.min < normalStats.min && fatStats.mean < normalStats.mean && fatStats.skew < normalStats.skew) {
        console.log("\n✅ SUCCESS: Fat Tails produced deeper crashes, lower mean, and negative skew.");
    } else {
        console.log("\n❌ FAILURE: Fat Tails did not produce significant difference.");
    }
}

runTest();
