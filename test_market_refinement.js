const fs = require('fs');
const path = require('path');

// Mock Environment
global.window = {};
global.Config = {
    getConfig: (configs, key, defaultValue) => {
        if (configs && configs[key] !== undefined) return configs[key];
        return defaultValue;
    }
};

// Load Scripts
const statsContent = fs.readFileSync(path.join(__dirname, 'js/engine/stats.js'), 'utf8');
eval(statsContent);
global.Stats = window.Stats;

const marketContent = fs.readFileSync(path.join(__dirname, 'js/engine/market.js'), 'utf8');
eval(marketContent);

(async () => {
    console.log("Running Refined Market Verification...");

    const baseConfig = {
        RANDOM_SEED: 12345,
        ENFORCE_MAX_BAD_STREAK: false,
        MAX_CONSECUTIVE_BAD_YEARS: 2, // Very strict to force hits if checked

        // Correlation
        CORR_START: 0.5,
        CORR_END: 0.5
    };

    // Test 1: Constraint OFF
    const dataOff = await window.generateMarketData(100, 30, { ...baseConfig, ENFORCE_MAX_BAD_STREAK: false });
    if (dataOff.info.constraintHits === 0) {
        console.log("PASS: ENFORCE_MAX_BAD_STREAK = false resulted in 0 hits.");
    } else {
        console.error(`FAIL: ENFORCE_MAX_BAD_STREAK = false but got ${dataOff.info.constraintHits} hits.`);
    }

    // Test 2: Constraint ON
    const dataOn = await window.generateMarketData(100, 30, { ...baseConfig, ENFORCE_MAX_BAD_STREAK: true });
    // Note: With 100 sims and 30 years, it's statistically likely to have > 2 bad years in a row at least once?
    // Let's see. If 0 hits, maybe my threshold is too loose or data is too good.
    // Let's force it by making returns terrible.
    const badConfig = {
        ...baseConfig,
        ENFORCE_MAX_BAD_STREAK: true,
        MAX_CONSECUTIVE_BAD_YEARS: 1,
        S_CAGR_START: -0.20, // Force negative returns
        S_CAGR_END: -0.20
    };
    const dataBad = await window.generateMarketData(100, 10, badConfig);
    if (dataBad.info.constraintHits > 0) {
        console.log(`PASS: ENFORCE_MAX_BAD_STREAK = true caught ${dataBad.info.constraintHits} hits.`);
    } else {
        // If input is -20% CAGR, almost every year should be bad.
        // Consecutive bad years > 1 should happen.
        console.error("FAIL: ENFORCE_MAX_BAD_STREAK = true but got 0 hits with -20% CAGR.");
    }

    // Test 3: Correlation optimization check (indirectly via output validity)
    // If optimization broke something, values might be NaN or weird.
    let nanCount = 0;
    for (let x of dataOff.stocks) { if (isNaN(x)) nanCount++; }
    if (nanCount === 0) {
        console.log("PASS: No NaNs found (Correlation calc robust).");
    } else {
        console.error(`FAIL: Found ${nanCount} NaNs.`);
    }

    console.log("Refinement Verification Complete.");
})();
