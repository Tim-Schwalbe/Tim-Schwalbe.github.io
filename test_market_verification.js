const fs = require('fs');
const path = require('path');

// Mock Browser Environment
global.window = {};
global.Config = {
    getConfig: (configs, key, defaultValue) => {
        if (configs && configs[key] !== undefined) return configs[key];
        return defaultValue;
    }
};

// Load Scripts
const statsContent = fs.readFileSync(path.join(__dirname, 'js/engine/stats.js'), 'utf8');
eval(statsContent); // populate window.Stats
global.Stats = window.Stats;

const marketContent = fs.readFileSync(path.join(__dirname, 'js/engine/market.js'), 'utf8');
// market.js uses Stats and Config globals.
eval(marketContent); // populate window.generateMarketData

// Run Test
console.log("Running Market Data Verification...");

const numSims = 1000;
const years = 30;
const months = years * 12;

const configs = {
    RANDOM_SEED: 12345,
    CORR_START: 0.5,
    CORR_END: 0.5,
    FORCE_CRASH: true,
    CRASH_DURATION: 1, // 1 year crash

    // Volatilities (Monthly approx)
    S_VOL_START: 0.20,
    S_VOL_END: 0.20,
    B_VOL_START: 0.05,

    // CAGR
    S_CAGR_START: 0.10,
    B_CAGR_START: 0.05,
    C_CAGR_START: 0.15
};

const data = window.generateMarketData(numSims, years, configs);

// 1. Verify Structure
if (!data.stocks || data.stocks.length !== numSims * months) {
    console.error("ERROR: Stocks array length mismatch");
    process.exit(1);
}

// 2. Verify Correlation (First month only to avoid time-varying effects mixing)
// We'll check first month across all sims
let sumS = 0, sumB = 0, sumSB = 0, sumS2 = 0, sumB2 = 0;
const n = numSims;

for (let s = 0; s < numSims; s++) {
    const idx = s * months + 0; // First month
    let rS = data.stocks[idx];
    let rB = data.bonds[idx];

    // Normalize? No, just pearson on log returns
    sumS += rS;
    sumB += rB;
    sumSB += rS * rB;
    sumS2 += rS * rS;
    sumB2 += rB * rB;
}

const meanS = sumS / n;
const meanB = sumB / n;
const varS = (sumS2 / n) - (meanS * meanS);
const varB = (sumB2 / n) - (meanB * meanB);
const covSB = (sumSB / n) - (meanS * meanB);
const corrSB = covSB / Math.sqrt(varS * varB);

console.log(`Target Correlation: ${configs.CORR_START}`);
console.log(`Measured Correlation (Stocks-Bonds, Month 0): ${corrSB.toFixed(4)}`);

if (Math.abs(corrSB - configs.CORR_START) > 0.05) {
    console.error("WARNING: Correlation deviation > 0.05");
} else {
    console.log("PASS: Correlation within expected range.");
}

// 3. Verify Crash Logic
// Check first 12 months (Crash Duration = 1 year)
let crashFailures = 0;
for (let s = 0; s < numSims; s++) {
    for (let m = 0; m < 12; m++) {
        const idx = s * months + m;
        // Logic: stockLogReturns <= -0.05
        if (data.stocks[idx] > -0.05) {
            crashFailures++;
            console.log(`Failure at Sim ${s} Month ${m}: ${data.stocks[idx]}`);
            if (crashFailures > 5) break;
        }
    }
}

if (crashFailures === 0) {
    console.log("PASS: Crash logic forced all returns <= -0.05 for first year.");
} else {
    console.error(`FAIL: ${crashFailures} months in crash period had return > -0.05`);
}

// 4. Verify Post-Crash (Year 2)
// Should have normal distribution (some positive)
let postCrashPositives = 0;
for (let s = 0; s < numSims; s++) {
    const idx = s * months + 13; // Year 2, month 2
    if (data.stocks[idx] > 0) postCrashPositives++;
}

console.log(`Post-Crash Positive Months (Sample): ${postCrashPositives}/${numSims}`);
if (postCrashPositives > 0) {
    console.log("PASS: Post-crash returns are not stuck negative.");
} else {
    console.error("FAIL: No positive returns after crash?");
}

console.log("Verification Complete.");
