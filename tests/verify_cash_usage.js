const fs = require('fs');
const path = require('path');

// Mock browser
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
console.log("🕵️ DEBUG: CASH BUFFER SPENDING LOGIC");
console.log("=".repeat(80));

// Manually Construct Market Data
// Year 1: -80% Crash
// Year 2: +10% Recovery
// Year 3: +10% Recovery
// ...
const YEARS = 5;
const MONTHS = YEARS * 12;

const cryptoPath = new Float64Array(MONTHS);
const inflationPath = new Float64Array(MONTHS);

// Linear fill
for (let m = 0; m < MONTHS; m++) {
    let year = Math.floor(m / 12);
    if (year === 0) {
        // Crash Year: Total -80% -> log(0.20) = -1.61
        cryptoPath[m] = -1.61 / 12;
    } else {
        // Recovery Years: +10% -> log(1.10) = 0.095
        cryptoPath[m] = 0.0953 / 12;
    }
    inflationPath[m] = 0.03 / 12;
}

const marketData = {
    stocks: new Float64Array(MONTHS).fill(0),
    bonds: new Float64Array(MONTHS).fill(0),
    crypto: cryptoPath,
    inflation: inflationPath
};

const configs = {
    numSims: 1,
    years: YEARS,
    INVESTED_AMOUNT: 3600000,
    CASH_BUFFER: 600000, // 10 Years @ 60k

    ALLOC_STOCKS: 0.0, ALLOC_CRYPTO: 1.0, ALLOC_BONDS: 0.0,
    TARGET_ANNUAL_EXP: 60000,

    // Legacy flags off
    FORCE_CRASH: false,
    MAX_CONSECUTIVE_BAD_YEARS: 100
};

console.log(`Setup:
 Invested: $3.6M
 Buffer:   $600k (10 Years of Spend)
 Year 1: -80% Crash
 Year 2+: +10% Recovery
 Expected: Cash Buffer should be used until Portfolio recovers? 
 Actual: ??
`);

// We cannot easily inject logging into simulatePortfolio without modifying it.
// So we will Infer from the Final Results?
// No, simulatedPortfolio doesn't return detailed history.
// We need to modify `simulatePortfolio` locally or just analyze the code logic.

// BUT, we can make a tiny copy of the logic here to verify expectation.
// engine.js Logic:
// if (growthFactor < 1.0 && cashBalance >= currentMonthlyWithdrawal) { Use Cash }
// else { Use Portfolio }

console.log("Simulating Logic Step-by-Step:\n");

let portfolio = configs.INVESTED_AMOUNT;
let cash = configs.CASH_BUFFER;
let wdAnnual = configs.TARGET_ANNUAL_EXP;

for (let m = 0; m < MONTHS; m++) {
    const year = Math.floor(m / 12);
    // 1. Market Move
    const ret = cryptoPath[m];
    const growth = Math.exp(ret);

    portfolio *= growth;

    const wdMonthly = wdAnnual / 12;

    // 2. Withdrawal Logic (The Engine's Logic)
    let source = "";
    if (growth < 1.0 && cash >= wdMonthly) {
        cash -= wdMonthly;
        source = "CASH";
    } else {
        portfolio -= wdMonthly; // Selling Low?
        source = "PORTFOLIO";
    }

    if (m % 12 === 0) {
        console.log(`Year ${year + 1} Month 1: Growth ${(growth - 1) * 100}% | Port $${(portfolio / 1000).toFixed(0)}k | Cash $${(cash / 1000).toFixed(0)}k | Paid via: ${source}`);
    }
}

console.log(`\nFinal State: Port $${(portfolio / 1000).toFixed(0)}k | Cash $${(cash / 1000).toFixed(0)}k`);

if (cash > 500000 && portfolio < 1000000) {
    console.log("\n❌ DIAGNOSIS CONFIRMED");
    console.log("   The engine is hoarding cash ($600k -> ~500k spent only 100k)");
    console.log("   While the portfolio was decimated by withdrawals during the 'Recovery' phase.");
    console.log("   Reason: Years 2-5 had positive returns, so the engine switched back to Portfolio spending.");
    console.log("   Result: You Sold the Bottom.");
} else {
    console.log("✅ Logic seems ok?");
}
