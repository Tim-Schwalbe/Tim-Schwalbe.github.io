
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

// Helper to calculate CAGR
const calcCAGR = (logReturns) => {
    let sum = 0;
    for (let r of logReturns) sum += r;
    const months = logReturns.length;
    const finalWealth = Math.exp(sum);
    return (Math.pow(finalWealth, 12 / months) - 1);
};

console.log("Running 100% Crypto Simulation with V4 Empirical Mode (2013-2024 Params)...");

const ITERATIONS = 1000;
const YEARS = 30;
const MONTHS = YEARS * 12;

let totalCAGR = 0;
let totalMDD = 0;
let finalWealths = [];
let regimeCounts = { 0: 0, 1: 0, 2: 0 };

// Mock Configs - Minimal overrides
const configs = {
    ALLOC_STOCKS: 0,
    ALLOC_BONDS: 0,
    ALLOC_CRYPTO: 1,
    USE_FAT_TAILS: true,
    SILENT: false
};

// Generate Data
const data = window.generateMarketData(ITERATIONS, YEARS, configs);
const allCryptoReturns = data.crypto;

for (let i = 0; i < ITERATIONS; i++) {
    const startIdx = i * MONTHS;
    const endIdx = startIdx + MONTHS;
    const cReturns = allCryptoReturns.slice(startIdx, endIdx);

    const cagr = calcCAGR(cReturns);
    totalCAGR += cagr;

    let peak = 1.0;
    let wealth = 1.0;
    let maxDD = 0;

    for (let j = 0; j < MONTHS; j++) {
        const r = cReturns[j];
        wealth *= Math.exp(r);
        if (wealth > peak) peak = wealth;
        const dd = (peak - wealth) / peak;
        if (dd > maxDD) maxDD = dd;

        if (r < -0.30) regimeCounts[1]++;
        else if (r > 0.25) regimeCounts[2]++;
        else regimeCounts[0]++;
    }
    totalMDD += maxDD;
    finalWealths.push(wealth);
}

finalWealths.sort((a, b) => a - b);
const medianWealth = finalWealths[Math.floor(ITERATIONS / 2)];
const avgCAGR = (totalCAGR / ITERATIONS) * 100;
const avgMDD = (totalMDD / ITERATIONS) * 100;

console.log(`\nResults (${ITERATIONS} runs, ${YEARS} years):`);
console.log(`Median Final Wealth: ${medianWealth.toExponential(2)}x (Initial=1)`);
console.log(`Average CAGR: ${avgCAGR.toFixed(2)}%`);
console.log(`Average Max Drawdown: ${avgMDD.toFixed(2)}%`);

const totalMonths = ITERATIONS * MONTHS;
console.log(`\nRegime Frequency (Approx via Returns):`);
console.log(`Bear (Drop < -30%): ${(regimeCounts[1] / totalMonths * 100).toFixed(2)}%`);
console.log(`Bull (Gain > 25%): ${(regimeCounts[2] / totalMonths * 100).toFixed(2)}%`);
