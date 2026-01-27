
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
console.log("💥 FORCE CRASH VS GUARDRAIL TEST (30 YEARS)");
console.log("=".repeat(80));

const configs = {
    numSims: 100,
    years: 30,
    INVESTED_AMOUNT: 3800000,
    CASH_BUFFER: 90000,
    TARGET_ANNUAL_EXP: 60000,

    ALLOC_STOCKS: 1.0,
    ALLOC_CRYPTO: 0.0,

    // GUARDRAIL SETTING (What user changed)
    MAX_CONSECUTIVE_BAD_YEARS: 30, // "Infinite" Freeze

    // CRASH SCENARIO (What user wanted)
    FORCE_CRASH: true,
    CRASH_DURATION: 30, // 30 Years of Pain

    // Market Params (overridden by crash logic)
    S_CAGR_START: 0.10, S_CAGR_END: 0.10, S_VOL_START: 0.20, S_VOL_END: 0.20,
    INFL_MEAN: 0.03, INFL_VOL: 0.015
};

console.log(`\nScenario Parameters:`);
console.log(`  Invested: $${(configs.INVESTED_AMOUNT / 1e6).toFixed(1)}M`);
console.log(`  Spending: $${(configs.TARGET_ANNUAL_EXP / 1e3).toFixed(0)}k/year`);
console.log(`  Guardrail Limit: ${configs.MAX_CONSECUTIVE_BAD_YEARS} years (Try to save capital by freezing)`);
console.log(`  Force Crash: ${configs.FORCE_CRASH}`);
console.log(`  Crash Duration: ${configs.CRASH_DURATION} YEARS (Market is NEGATIVE for 30 years)`);

const marketData = generateMarketData(configs.numSims, configs.years, configs);
const res = simulatePortfolio(-1, marketData, configs);

console.log(`\nResults:`);
console.log(`  Success Rate: ${(res.successRate * 100).toFixed(1)}%`);

let avgWealth = 0;
res.wealths.forEach(w => avgWealth += w);
avgWealth /= res.wealths.length;

console.log(`  Avg Final Wealth: $${(avgWealth).toFixed(2)}`);

if (res.successRate === 0) {
    console.log("\n✅ VERIFIED: A 30-year crash correctly depletes 100% of portfolios.");
    console.log("   The Guardrail (Limit 30) cannot save you from negative returns, only stagnation.");
} else {
    console.log("\n❌ UNEXPECTED: Some portfolios survived a 30-year crash?");
}
