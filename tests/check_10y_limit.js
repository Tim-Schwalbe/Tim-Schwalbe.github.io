
const fs = require('fs');
const path = require('path');

// Mock Browser Environment
const window = {
    crypto: { getRandomValues: (arr) => arr.forEach((v, i) => arr[i] = Math.floor(Math.random() * 256)) }
};
global.window = window;
global.document = {
    addEventListener: () => { },
    getElementById: () => null
};

// Load dependencies
const load = (file) => {
    const content = fs.readFileSync(path.join(__dirname, '../js', file), 'utf8');
    eval(content);
};

// Load Engine
load('utils/config.js');
global.Config = window.Config;
load('engine/stats.js');
global.Stats = window.Stats;
load('engine/market.js');

console.log("Running 10y Limit Verification...");

const ITERATIONS = 1000;
const YEARS = 20; // 10 years fat, 10 years normal
const MONTHS = YEARS * 12;

// Mock Configs
const configs = {
    ALLOC_STOCKS: 0,
    ALLOC_BONDS: 0,
    ALLOC_CRYPTO: 1,
    CRYPTO_CAGR_START: 0.60,
    CRYPTO_CAGR_END: 0.60,
    CRYPTO_VOL_START: 0.60,
    CRYPTO_VOL_END: 0.60,
    USE_FAT_TAILS: true,
    LIMIT_FAT_TAILS_10Y: true, // TESt TARGET
    // New Params are hardcoded in market.js
    PROB_CRASH: 0.005,
    PROB_MOONSHOT: 0.005
};

// Generate Data
const data = window.generateMarketData(ITERATIONS, YEARS, configs);
const allCryptoReturns = data.crypto;

let earlyFatCount = 0;
let transitionFatCount = 0;
let cleanFatCount = 0;

for (let i = 0; i < ITERATIONS; i++) {
    const startIdx = i * MONTHS;
    for (let m = 0; m < MONTHS; m++) {
        const r = allCryptoReturns[startIdx + m];
        // Thresholds: Log returns corresponding to -30% drop and +40% rally
        // Normal Vol is ~17%.
        // -35% Drop -> log(0.65) = -0.43. Z = -2.8 (Rare in Normal)
        // +50% Rally -> log(1.50) = 0.40. Z = +2.1 (Uncommon but possible in Normal)
        const isCrash = (r < -0.43);

        if (isCrash) {
            if (m < 120) earlyFatCount++;
            else if (m < 180) transitionFatCount++;
            else cleanFatCount++;
        }
    }
}

const totalEarlyMonths = ITERATIONS * 120;
const totalTransitionMonths = ITERATIONS * 60;
const totalCleanMonths = ITERATIONS * 60;

console.log(`Early (0-10y) Crashes: ${earlyFatCount} / ${totalEarlyMonths} (${(earlyFatCount / totalEarlyMonths * 100).toFixed(4)}%)`);
console.log(`Transition (10-15y) Crashes: ${transitionFatCount} / ${totalTransitionMonths} (${(transitionFatCount / totalTransitionMonths * 100).toFixed(4)}%)`);
console.log(`Clean (15-20y) Crashes: ${cleanFatCount} / ${totalCleanMonths} (${(cleanFatCount / totalCleanMonths * 100).toFixed(4)}%)`);

// Expect Clean to be very low (Normal Vol only ~0.44%)
// Expect Early to be high (~2.2%)
if ((cleanFatCount / totalCleanMonths) < 0.006) {
    console.log("SUCCESS: Fat tails effectively removed after Year 15.");
} else {
    console.log("FAILURE: Fat tails persist after Year 15.");
}
