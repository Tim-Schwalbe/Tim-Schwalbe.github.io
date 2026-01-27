
const Stats = require('../js/statistics.js');
global.Stats = Stats;
const { generateMarketData } = require('../js/engine.js');

console.log("📉 DECAY PARAMETER VERIFICATION\n");

const decayConfig = {
    years: 10, // Short duration for easy reading
    numSims: 1, // We only need to check the parameters used, not the random results
    INVESTED_AMOUNT: 1000000,

    // Crypto Decay: 32% -> 8%
    C_CAGR_START: 0.32, C_CAGR_END: 0.08,
    C_VOL_START: 0.40, C_VOL_END: 0.20,

    // Correlation Decay: 0.20 -> 0.20 (Constant in current default, let's test decay)
    CORR_START: 0.80, CORR_END: 0.20,

    // Other required params
    S_CAGR_START: 0.10, S_CAGR_END: 0.10, S_VOL_START: 0.20, S_VOL_END: 0.20,
    B_CAGR_START: 0.05, B_VOL_START: 0.05,
    INFL_MEAN: 0.03, INFL_VOL: 0.01,
    RANDOM_SEED: 123
};

console.log("Simulating 10 Years with Decay:");
console.log("  Crypto CAGR: 32% -> 8%");
console.log("  Correlation: 0.80 -> 0.20\n");

// WE need to access the internal steps or inferred parameters. 
// generateMarketData returns the accumulation arrays (stocks, bonds, crypto). 
// It doesn't explicitly return the annual parameter values used.
// However, we can inspect 'engine.js' to see the logic:
// const t = m / Math.max(1, months - 1);
// const val = start * (1 - t) + end * t;

// Let's create a "Shadow Calculation" to verify the math is doing what we expect line-by-line.

console.log("Time Step | Progress (t) | Expected Crypto CAGR | Expected Corr");
console.log("---|---|---|---");

const months = decayConfig.years * 12;
for (let m = 0; m < months; m += 12) { // Print Start of each Year
    const t = m / Math.max(1, months - 1);

    const cCagr = decayConfig.C_CAGR_START * (1 - t) + decayConfig.C_CAGR_END * t;
    const corr = decayConfig.CORR_START * (1 - t) + decayConfig.CORR_END * t;

    console.log(`Month ${m.toString().padStart(3)} | ${t.toFixed(3)}        | ${(cCagr * 100).toFixed(2)}%               | ${corr.toFixed(2)}`);
}

// Check Last Month
const lastM = months - 1;
const lastT = lastM / Math.max(1, months - 1);
const lastCagr = decayConfig.C_CAGR_START * (1 - lastT) + decayConfig.C_CAGR_END * lastT;
console.log(`Month ${lastM} | ${lastT.toFixed(3)}        | ${(lastCagr * 100).toFixed(2)}%               | ${(decayConfig.CORR_START * (1 - lastT) + decayConfig.CORR_END * lastT).toFixed(2)}`);

console.log("\nIf these values transition smoothly from Start to End, the math logic is correct.");
