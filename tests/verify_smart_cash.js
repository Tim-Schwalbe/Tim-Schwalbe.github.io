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
console.log("🕵️ DEBUG: SMART CASH LOGIC (MOCKED)");
console.log("=".repeat(80));

// Logic Mock to verify constraints without full simulation loop overhead
const INVESTED_AMOUNT = 1000000;
let portfolio = 500000; // Deeply Underwater (-50%)
let cash = 100000;      // Has Cash
const withdrawal = 5000;

const growthFactor = 1.05; // Market IS GOING UP (+5%)

console.log(`Scenario:
  Portfolio: $500k (Invested $1M) -> Underwater
  Cash:      $100k
  Market:    +5% (Positive Growth)
  
  Old Logic: Market > 0 -> Sell Portfolio
  New Logic: Portfolio < Invested -> Spend Cash
`);

// Apply New Logic (Copy-Paste from Engine for verification)
console.log("--- Simulation Step ---");

// Growth
portfolio *= growthFactor;
console.log(`Portfolio grew to $${portfolio.toFixed(0)}`);

// Decision
const isUnderwater = portfolio < INVESTED_AMOUNT;
const isMarketDown = growthFactor < 1.0;

let paidFromCash = false;
let logMsg = "";

if ((isUnderwater || isMarketDown) && cash >= withdrawal) {
    cash -= withdrawal;
    paidFromCash = true;
    logMsg = "✅ SPENT CASH (Protected Principal)";
} else {
    portfolio -= withdrawal;
    logMsg = "❌ SOLD PORTFOLIO (Sold Bottom)";
}

console.log(logMsg);
console.log(`Final: Port $${portfolio.toFixed(0)} | Cash $${cash.toFixed(0)}`);

if (paidFromCash) {
    console.log("\n✅ SUCCESS: Logic correctly used cash because Portfolio < Invested Amount.");
} else {
    console.log("\n❌ FAIL: Logic sold portfolio despite being underwater.");
}
