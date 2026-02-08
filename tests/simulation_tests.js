
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// --- SETUP SANDBOX ---
const sandbox = {
    window: {},
    document: { getElementById: () => ({}) },
    console: console,
    Math: Math,
    parseFloat: parseFloat,
    parseInt: parseInt,
    Float64Array: Float64Array
};
sandbox.window = sandbox;
vm.createContext(sandbox);

// --- LOAD DEPENDENCIES ---
const jsDir = path.join(__dirname, '../js');
function load(p) {
    const code = fs.readFileSync(path.join(jsDir, p), 'utf8');
    vm.runInContext(code, sandbox);
}

load('utils/config.js');
load('engine/stats.js');
load('engine/market.js');
load('engine/swr.js');
load('engine/simulator.js');

const Config = sandbox.window.Config;
const Stats = sandbox.window.Stats;
const generateMarketData = sandbox.window.generateMarketData;
const simulatePortfolio = sandbox.window.simulatePortfolio;
const findSWR = sandbox.window.findSWR;

let totalTests = 0, passedTests = 0, failedTests = 0;

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
    }
}

function assert(condition, msg) { return condition ? true : msg; }
function expectRate(res, expected, tolerance = 0.001) {
    if (Math.abs(res.successRate - expected) > tolerance) {
        return `Expected rate ${expected}, got ${res.successRate} (${(res.successRate * 100).toFixed(1)}%)`;
    }
    return true;
}

console.log("🚀 FINAL COMPREHENSIVE SIMULATION AUDIT 🚀");

// ... (existing code) ...

// === CRYPTO + CASH BUFFER BEAR MARKET TEST ===
runTest("Crypto 100% + Cash Buffer Protects During Volatility", () => {
    // Scenario: High volatility crypto with cash buffer to smooth withdrawals
    // WITHOUT buffer: Portfolio might fail during drawdowns
    // WITH    buffer: Cash protects during down months, refills during recovery
    const annualSpend = 60000;

    // Test A: No Buffer (vulnerable to sequence risk)
    const cfgNoBuffer = {
        years: 20, numSims: 200,
        INVESTED_AMOUNT: 1000000,
        CASH_BUFFER: 0,
        ALLOC_CRYPTO: 1.0, ALLOC_STOCKS: 0,
        TARGET_ANNUAL_EXP: annualSpend,
        C_CAGR_START: 0.15, C_VOL_START: 0.80, // Very high volatility
        REFILL_CASH_BUFFER: false
    };
    const resNoBuffer = simulatePortfolio(-1, generateMarketData(200, 20, cfgNoBuffer), cfgNoBuffer);

    // Test B: With Buffer (protected)
    const cfgWithBuffer = {
        ...cfgNoBuffer,
        CASH_BUFFER: annualSpend * 3, // 3 years coverage
        REFILL_CASH_BUFFER: true
    };
    const resWithBuffer = simulatePortfolio(-1, generateMarketData(200, 20, cfgWithBuffer), cfgWithBuffer);

    // Buffer should improve success rate by at least 1%
    const improvement = resWithBuffer.successRate - resNoBuffer.successRate;
    return improvement > 0.01 ? true : `Buffer didn't help enough: ${(resNoBuffer.successRate * 100).toFixed(1)}% → ${(resWithBuffer.successRate * 100).toFixed(1)}% (${(improvement * 100).toFixed(1)}% improvement)`;
});

// === MIXED ASSET ALLOCATION TESTS (50 Scenarios) ===
console.log("\n📊 Running 50 Mixed Asset Allocation Tests...");
let mixedTestsPassed = 0;
let mixedTestsFailed = 0;

for (let i = 0; i < 50; i++) {
    // Generate random allocation (ensure they sum to 100%)
    const cryptoPct = Math.floor(Math.random() * 101);
    const stocksPct = Math.floor(Math.random() * (101 - cryptoPct));
    const bondsPct = 100 - cryptoPct - stocksPct;

    const testName = `Mixed ${i + 1}: ${cryptoPct}% Crypto, ${stocksPct}% Stocks, ${bondsPct}% Bonds`;

    try {
        const cfg = {
            years: 30, numSims: 100,
            INVESTED_AMOUNT: 1000000, CASH_BUFFER: 0,
            ALLOC_CRYPTO: cryptoPct / 100,
            ALLOC_STOCKS: stocksPct / 100,
            TARGET_ANNUAL_EXP: 40000, // 4% withdrawal
            C_CAGR_START: 0.15, C_VOL_START: 0.60,
            S_CAGR_START: 0.08, S_VOL_START: 0.16,
            B_CAGR_START: 0.045, B_VOL_START: 0.05
        };

        const res = simulatePortfolio(-1, generateMarketData(100, 30, cfg), cfg);

        // Verification: Result should be valid (wealths array populated, success rate between 0-1)
        const isValid = res.wealths.length === cfg.numSims &&
            res.successRate >= 0 && res.successRate <= 1 &&
            !isNaN(res.successRate);

        if (isValid) {
            mixedTestsPassed++;
            if (i % 10 === 0) console.log(`   ✅ ${testName} → ${(res.successRate * 100).toFixed(1)}% success`);
        } else {
            mixedTestsFailed++;
            console.error(`   ❌ ${testName} → INVALID RESULT`);
        }
    } catch (e) {
        mixedTestsFailed++;
        console.error(`   ❌ ${testName} → EXCEPTION: ${e.message}`);
    }
}

console.log(`\n   Mixed Allocation Tests: ${mixedTestsPassed}/50 passed`);
totalTests += 50;
passedTests += mixedTestsPassed;
failedTests += mixedTestsFailed;


// === CARD METRICS VALIDATION ===
runTest("UI Card Metrics: SWR & Required Capital", () => {
    // Scenario: 30 Years, 50/50 Stocks/Bonds, 40k Annual Spend
    const cfg = {
        years: 30, numSims: 500,
        INVESTED_AMOUNT: 1000000, CASH_BUFFER: 0,
        TARGET_ANNUAL_EXP: 40000,
        ALLOC_STOCKS: 0.50, ALLOC_CRYPTO: 0,
        // Standard params
        S_CAGR_START: 0.08, S_VOL_START: 0.16,
        B_CAGR_START: 0.045, B_VOL_START: 0.05,
        INFL_MEAN: 0.03, INFL_VOL: 0.015,
        TARGET_SUCCESS_PERCENT: 95
    };

    // 1. Generate Data
    const marketData = generateMarketData(500, 30, cfg);

    // 2. Calculate SWR (UI Logic)
    // findSWR should be available via window.findSWR (loaded from swr.js)
    const findSWR = sandbox.window.findSWR;
    if (!findSWR) return "findSWR not found in sandbox";

    const targetOdds = cfg.TARGET_SUCCESS_PERCENT / 100;
    const swr = findSWR(targetOdds, marketData, cfg);

    // Expect SWR between 3.0% and 4.0% for this conservatism
    if (swr < 0.030 || swr > 0.040) {
        return `SWR ${swr.toFixed(4)} out of expected range (3.0-4.0%)`;
    }

    // 3. Calculate Required Capital (Goal)
    // Formula: Target Spend / SWR
    const requiredCapital = cfg.TARGET_ANNUAL_EXP / swr;

    // If SWR is 3.5%, Required = 40k / 0.035 = 1.14M
    // If SWR is 3.0%, Required = 40k / 0.03 = 1.33M
    if (requiredCapital < 1000000 || requiredCapital > 1500000) {
        return `Required Capital ${Math.round(requiredCapital)} out of range`;
    }

    // 4. Calculate Shortfall
    // Total Capital = 1M
    const totalCapital = cfg.INVESTED_AMOUNT + cfg.CASH_BUFFER; // 1,000,000
    const shortfall = requiredCapital - totalCapital;

    // Expect Shortfall to be positive (since 1M < ~1.14M)
    if (shortfall <= 0) {
        return `Expected shortfall > 0, got ${shortfall}`;
    }

    // 5. Verify Safe Monthly Budget
    // Safe Withdrawal Amount = Total Capital * SWR
    const safeWithdrawalAmount = totalCapital * swr;
    const safeMonthly = safeWithdrawalAmount / 12;

    // If SWR 3.5%, Safe Annual = 35k. Monthly = ~2916.
    if (safeMonthly < 2500 || safeMonthly > 3500) {
        return `Safe Monthly ${safeMonthly.toFixed(0)} out of range`;
    }

    return true;
});


// === CARD METRICS: REALITY, REALIZED PERFORMANCE & LIFESTYLE ===
runTest("UI Card Metrics: Reality, Realized Performance & Lifestyle", () => {
    // Scenario: 30 Years, 50/50 Stocks/Bonds
    // We use a fixed seed to ensure deterministic results for assertions if possible, 
    // or we check for consistency (e.g., CAGR matches input Mean within margin).
    const cfg = {
        years: 30, numSims: 500,
        INVESTED_AMOUNT: 1000000, CASH_BUFFER: 0,
        TARGET_ANNUAL_EXP: 40000,
        ALLOC_STOCKS: 0.50, ALLOC_CRYPTO: 0,
        S_CAGR_START: 0.10, S_VOL_START: 0.15, // 10% Mean
        B_CAGR_START: 0.05, B_VOL_START: 0.05, // 5% Mean
        INFL_MEAN: 0.03, INFL_VOL: 0.01,
        TARGET_SUCCESS_PERCENT: 95
    };

    // 1. Generate Data
    const marketData = generateMarketData(500, 30, cfg);

    // 2. Run Simulation
    const res = simulatePortfolio(-1, marketData, cfg);
    const stats = res.stats;

    // --- A. REALIZED MARKET PERFORMANCE (CAGR) ---
    // Logic from Renderer: exp(avgLogReturn * 12) - 1
    const calcCAGR = (logReturns) => {
        if (!logReturns || logReturns.length === 0) return 0;
        let sum = 0;
        for (let i = 0; i < logReturns.length; i++) sum += logReturns[i];
        const avg = sum / logReturns.length;
        return (Math.exp(avg * 12) - 1);
    };

    const realizedStock = calcCAGR(marketData.stocks);
    const realizedBond = calcCAGR(marketData.bonds);

    // Assert: Realized should be close to Input parameters (Law of Large Numbers)
    // Input 10% -> Expect 9% to 11%
    if (Math.abs(realizedStock - 0.10) > 0.02) {
        return `Stock Realized CAGR ${(realizedStock * 100).toFixed(2)}% far from input 10%`;
    }
    if (Math.abs(realizedBond - 0.05) > 0.015) {
        return `Bond Realized CAGR ${(realizedBond * 100).toFixed(2)}% far from input 5%`;
    }

    // --- B. PORTFOLIO DRAWDOWNS ---
    // Expect some drawdowns in a 30 year period.
    // Median Max Drawdown should be > 0.
    if (stats.medianMaxDrawdown <= 0) {
        return `Median Max Drawdown is 0%, highly unlikely for 30y stocks`;
    }
    // Worst case should be worse than median
    if (stats.worstDrawdown < stats.medianMaxDrawdown) {
        return `Worst Drawdown (${stats.worstDrawdown}) < Median (${stats.medianMaxDrawdown})`;
    }

    // --- C. RECOVERY DURATION ---
    if (stats.medianDrawdownDuration < 0 || stats.worstDrawdownDuration < stats.medianDrawdownDuration) {
        return `Invalid Recovery Durations: Med ${stats.medianDrawdownDuration}, Worst ${stats.worstDrawdownDuration}`;
    }

    // --- D. SURVIVAL MARGIN (LOWEST CAPITAL) ---
    // With 4% WR (40k on 1M), survival is high but lowest capital should be < 1M usually (dip before grow)
    // or at least valid numbers.
    if (stats.medianLowestCapital > 1500000) {
        return `Median Lowest Capital seemingly too high: ${stats.medianLowestCapital}`;
    }
    if (stats.absoluteLowestCapital > stats.medianLowestCapital) {
        return `Absolute Lowest > Median Lowest`;
    }

    // --- E. LIFESTYLE & FLEXIBILITY ---
    // Median Monthly Spend is NOMINAL average.
    // With 3% inflation, 30 years, factor is ~1.5x to 2.4x.
    // It should definitely be > Target.
    const targetMonthly = cfg.TARGET_ANNUAL_EXP / 12;

    if (stats.medianMonthlySpend < targetMonthly) {
        return `Median Monthly Spend ${stats.medianMonthlySpend.toFixed(0)} < Initial Target ${targetMonthly.toFixed(0)} (Should grow with inflation)`;
    }
    // Upper bound sanity check (e.g., shouldn't triple in real terms, but nominal could be ~2x)
    if (stats.medianMonthlySpend > targetMonthly * 3.0) {
        return `Median Monthly Spend ${stats.medianMonthlySpend.toFixed(0)} seems too high (>3x target)`;
    }

    // Fragility Score
    // Should be valid number 0-10
    if (stats.fragilityScore < 0 || stats.fragilityScore > 10) {
        return `Fragility Score ${stats.fragilityScore} out of range 0-10`;
    }

    // Stability Index
    // With fixed real spending, nominal spending rises with inflation (3% per year).
    // This creates variance in the nominal numbers (CV approx 25-30% for 30y @ 3%).
    // So Stability (100 - CV) should be around 70-75%, not 100.
    if (stats.stabilityIndex < 60) {
        return `Stability Index ${stats.stabilityIndex} too low (Expected ~70% for inflation adjusted drift)`;
    }

    return true;
});

// === REGRESSION: CEILING USAGE RATE ===
runTest("Regression: Ceiling Usage Rate Calculation", () => {
    // Scenario: 6M Capital, 30k Spend => 0.5% SWR.
    // Market: 10% strict growth (no vol).
    // ... (same setup) ...
    // Expected Hits: ~25 years out of 30.
    // Expected Rate: ~83%.

    const cfg = {
        years: 30, numSims: 1,
        INVESTED_AMOUNT: 6000000, CASH_BUFFER: 0,
        TARGET_ANNUAL_EXP: 30000,
        ALLOC_STOCKS: 1.0, ALLOC_CRYPTO: 0,
        S_CAGR_START: 0.10, S_VOL_START: 0.0001, // Zero vol for determinism
        INFL_MEAN: 0.00, INFL_VOL: 0.00,
        CEILING_EARLY: 150, CEILING_LATE: 150,
        INITIAL_SWR_OVERRIDE: 0.005 // Force 0.5% if needed, or rely on calc
    };

    // Generate 'Perfect' Market Data
    // We can manually construct market data to rely less on generator randomness
    // But low vol generator is fine.
    const marketData = generateMarketData(1, 30, cfg);

    const res = simulatePortfolio(-1, marketData, cfg);
    const stats = res.stats;

    console.log(`[DEBUG] Ceiling Hit Rate: ${(stats.ceilingHitRate * 100).toFixed(2)}%`);

    // With fix, this should be ~83%.
    // If < 50%, something is still wrong.
    if (stats.ceilingHitRate < 0.50) {
        return `Ceiling Rate ${(stats.ceilingHitRate * 100).toFixed(2)}% is too low (Expected > 50%)`;
    }

    return true;
});

// === SUMMARY LOGS ===
console.log(`\n🏁 SUMMARY: ${passedTests}/${totalTests} Passed.`);
if (failedTests > 0) {
    console.log("❌ SOME TESTS FAILED");
    process.exit(1);
} else {
    console.log("✅ ALL TESTS PASSED");
}


