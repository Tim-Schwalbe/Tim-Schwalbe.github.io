
const Stats = require('../js/statistics.js');
global.Stats = Stats;
const { generateMarketData, simulatePortfolio } = require('../js/engine.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
    totalTests++;
    console.log(`\n🔹 TEST: ${name}`);
    try {
        const result = fn();
        if (result === true) {
            passedTests++;
            console.log(`   ✅ PASS`);
        } else {
            failedTests++;
            console.error(`   ❌ FAIL: ${result}`);
        }
    } catch (e) {
        failedTests++;
        console.error(`   ❌ EXCEPTION: ${e.message}`);
        console.error(e);
    }
}

function assert(condition, msg) {
    return condition ? true : msg;
}

function expectRate(res, expected, tolerance = 0.001) {
    if (Math.abs(res.successRate - expected) > tolerance) {
        return `Expected rate ${expected}, got ${res.successRate} (${(res.successRate * 100).toFixed(1)}%)`;
    }
    return true;
}

console.log("🚀 STARTING REFINED SIMULATION AUDIT 🚀");

// --- 1. ZERO CAPITAL CHECK ---
runTest("Boundary: Zero Invested + Zero Cash", () => {
    const cfg = {
        years: 10, numSims: 100,
        INVESTED_AMOUNT: 0, CASH_BUFFER: 0,
        TARGET_ANNUAL_EXP: 1000,
        ALLOC_STOCKS: 1.0, ALLOC_CRYPTO: 0
    };
    const res = simulatePortfolio(-1, generateMarketData(100, 10, cfg), cfg);
    return expectRate(res, 0.0);
});

// --- 2. LOGIC: CASH BUFFER USAGE ---
// Fix: Set Inflation to 0 to ensure $20k covers exactly 2 years of $10k spending
runTest("Logic: Cash Buffer covers Portfolio Depletion (0% Inf)", () => {
    const cfg = {
        years: 2, numSims: 100,
        INVESTED_AMOUNT: 1,
        CASH_BUFFER: 20000,
        ALLOC_STOCKS: 1.0,
        TARGET_ANNUAL_EXP: 10000,
        S_CAGR_START: -0.99, S_VOL_START: 0.1, // Crash
        INFL_MEAN: 0.0, INFL_VOL: 0.0          // DISABLE INFLATION
    };
    const res = simulatePortfolio(-1, generateMarketData(100, 2, cfg), cfg);
    return expectRate(res, 1.0);
});

// --- 3. CRYPTO LOGIC ---
runTest("Logic: Crypto Returns are Active", () => {
    const cfg = {
        years: 1, numSims: 1000,
        INVESTED_AMOUNT: 1000, CASH_BUFFER: 0,
        ALLOC_CRYPTO: 1.0, ALLOC_STOCKS: 0,
        TARGET_ANNUAL_EXP: 0,
        C_CAGR_START: 0.0, C_VOL_START: 1.0 // 100% Volatility
    };
    const res = simulatePortfolio(-1, generateMarketData(1000, 1, cfg), cfg);

    // Check variance of final wealths
    let sum = 0, sumSq = 0;
    res.wealths.forEach(w => { sum += w; sumSq += w * w; });
    const mean = sum / res.wealths.length;
    const variance = (sumSq / res.wealths.length) - (mean * mean);

    // If Crypto logic was missing (return 0), variance would be 0
    if (variance < 100) return `Variance too low (${variance.toFixed(2)}), Crypto likely flat.`;
    return true;
});

// --- 4. STRESS: HYPERINFLATION ---
runTest("Stress: Hyperinflation (50%) Ruins Portfolio", () => {
    const cfg = {
        years: 30, numSims: 100,
        INVESTED_AMOUNT: 1000000, CASH_BUFFER: 0,
        ALLOC_BONDS: 1.0, ALLOC_STOCKS: 0,
        B_CAGR_START: 0.05,
        INFL_MEAN: 0.50, // 50% Inflation
        TARGET_ANNUAL_EXP: 40000 // 4% Withdraw
    };
    const res = simulatePortfolio(-1, generateMarketData(100, 30, cfg), cfg);
    // Should be near 0
    if (res.successRate > 0.1) return `Success too high (${res.successRate}) for Hyperinflation`;
    return true;
});

// --- 5. CASH ONLY GOLDEN TEST ---
runTest("Golden: Cash Only Exact Match", () => {
    const cfg = {
        years: 10, numSims: 100,
        INVESTED_AMOUNT: 0, CASH_BUFFER: 600000,
        TARGET_ANNUAL_EXP: 60000,
        INFL_MEAN: 0, INFL_VOL: 0
    };
    const res = simulatePortfolio(-1, generateMarketData(100, 10, cfg), cfg);
    return expectRate(res, 1.0);
});


// --- 6. USER SCENARIO: 100% CRYPTO ---
// $1.5M Invested, $0 Cash, 30 Years, $60k Spend (4% WR).
// 100% Crypto (15% CAGR, 60% Vol).
// Should be very safe despite volatility because 15% >>> 4%.
runTest("User Scenario: 100% Crypto (Interp. UI Defaults)", () => {
    const cfg = {
        years: 30, numSims: 1000,
        INVESTED_AMOUNT: 1500000, CASH_BUFFER: 0,
        ALLOC_CRYPTO: 1.0, ALLOC_STOCKS: 0,
        TARGET_ANNUAL_EXP: 60000,
        C_CAGR_START: 0.32, C_CAGR_END: 0.08,
        C_VOL_START: 0.40, C_VOL_END: 0.20
    };
    const res = simulatePortfolio(-1, generateMarketData(1000, 30, cfg), cfg);
    return expectRate(res, 0.99, 0.02); // Expecting high success now!
});

console.log(`\n🏁 SUMMARY: ${passedTests}/${totalTests} Passed.`);
if (failedTests > 0) {
    console.log("❌ SOME TESTS FAILED");
    process.exit(1);
} else {
    console.log("✅ ALL TESTS PASSED");
}
