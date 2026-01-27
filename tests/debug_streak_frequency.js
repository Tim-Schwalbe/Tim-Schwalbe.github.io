const fs = require('fs');
const path = require('path');

const window = {
    crypto: {
        getRandomValues: (buffer) => require('crypto').randomFillSync(buffer)
    }
};
global.window = window;

const enginePath = path.join(__dirname, '../js/engine.js');
const statisticsPath = path.join(__dirname, '../js/statistics.js');
const engineCode = fs.readFileSync(enginePath, 'utf8');

global.Stats = require(statisticsPath);
eval(engineCode);

console.log("=".repeat(80));
console.log("🕵️ CRYPTO STREAK FREQUENCY ANALYZER");
console.log("=".repeat(80));

const NUM_SIMS = 10000;
const YEARS = 30;

const configs = {
    numSims: NUM_SIMS,
    years: YEARS,
    INVESTED_AMOUNT: 1500000,
    CASH_BUFFER: 0,
    ALLOC_STOCKS: 0.0, ALLOC_CRYPTO: 1.0, ALLOC_BONDS: 0.0,
    TARGET_ANNUAL_EXP: 60000,

    // Crypto Params from User Screenshot/Default
    // CAGR Start ~32%, End ~8%? Reference: index.html
    C_CAGR_START: 0.32, C_CAGR_END: 0.08,
    C_VOL_START: 0.40, C_VOL_END: 0.20,

    // Inflation
    INFL_MEAN: 0.031, INFL_VOL: 0.015,

    // Disable any interference
    MAX_CONSECUTIVE_BAD_YEARS: 100, // Effectively infinite, just observe
    FORCE_CRASH: false
};

console.log("Generating 10,000 Crypto paths...");
const marketData = generateMarketData(configs.numSims, configs.years, configs);

let streakCounts = new Array(31).fill(0); // Count of sims with MaxStreak = N
let totalBadYears = 0;

for (let s = 0; s < NUM_SIMS; s++) {
    let maxStreak = 0;
    let currentStreak = 0;

    for (let y = 0; y < YEARS; y++) {
        let annGrowth = 1.0;
        let annInfl = 1.0;
        const startIdx = s * YEARS * 12 + y * 12; // Wait, generateMarketData structure?
        // generateMarketData returns flat arrays? No, let's check engine.js
        // No, usually it returns one long array.
        // Wait, index logic in engine.js: yearStartIdx = s * months + y * 12;
        // Correct.

        const monthStart = s * (YEARS * 12) + y * 12;

        for (let k = 0; k < 12; k++) {
            const i = monthStart + k;
            annGrowth *= Math.exp(marketData.crypto[i]);
            annInfl *= (1 + marketData.inflation[i]);
        }

        if (annGrowth < annInfl) {
            currentStreak++;
            totalBadYears++;
        } else {
            if (currentStreak > maxStreak) maxStreak = currentStreak;
            currentStreak = 0;
        }
    }
    if (currentStreak > maxStreak) maxStreak = currentStreak;

    if (maxStreak > 30) maxStreak = 30;
    streakCounts[maxStreak]++;
}

console.log("\nProbability of Consecutive Bad Years (Crypto):");
let cumulative = 0;
for (let i = 0; i <= 10; i++) { // Show up to 10
    cumulative += streakCounts[i];
    const pct = (streakCounts[i] / NUM_SIMS) * 100;
    console.log(`Max Streak ${i} years: ${streakCounts[i]} sims (${pct.toFixed(2)}%)`);
}

const gt5 = NUM_SIMS - (streakCounts[0] + streakCounts[1] + streakCounts[2] + streakCounts[3] + streakCounts[4] + streakCounts[5]);
console.log(`\nSims with > 5 consecutive bad years: ${gt5} (${(gt5 / NUM_SIMS) * 100}%)`);

const gt10 = streakCounts.slice(11).reduce((a, b) => a + b, 0);
console.log(`Sims with > 10 consecutive bad years: ${gt10} (${(gt10 / NUM_SIMS) * 100}%)`);

console.log(`\nConclusion:`);
if (gt5 < 100) { // < 1%
    console.log("✅ RARE EVENT HYPOTHESIS CONFIRMED");
    console.log("   The simulator almost NEVER generates >5 bad years naturally.");
    console.log("   Therefore, changing the limit from 5 to 30 makes NO DIFFERENCE for 99% of runs.");
} else {
    console.log("❌ HYPOTHESIS REJECTED");
    console.log("   High streaks are common. The limit SHOULD be doing something.");
}
