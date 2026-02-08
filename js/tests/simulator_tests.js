/**
 * Simulator Test Suite
 * Run via console: window.runTests()
 */

window.runTests = function () {
    console.group("🧪 Running Simulator Tests...");
    let passed = 0;
    let failed = 0;

    const assert = (desc, actual, expected, tol = 0.001) => {
        const diff = Math.abs(actual - expected);
        if (diff <= tol) {
            console.log(`✅ ${desc}: PASSED (${actual})`);
            passed++;
        } else {
            console.error(`❌ ${desc}: FAILED. Expected ${expected}, got ${actual}`);
            failed++;
        }
    };

    // --- TEST 1: Basic Compounding (No Volatility) ---
    // 100k, 10% annual return, 0 withdraw, 1 year.
    // Expected: 100k * 1.1 = 110k
    const mockData1 = {
        stocks: new Array(12).fill(Math.log(1.1) / 12), // approx
        bonds: new Array(12).fill(0),
        crypto: new Array(12).fill(0),
        inflation: new Array(12).fill(0)
    };
    // Actually, simulator takes log returns. 10% annual = ln(1.1) total.
    // Monthly = ln(1.1)/12.
    // Let's use simpler manual step.

    // Instead of mocking deep arrays, let's test specific helper functions or small sims.
    // calculateMonthlyStep is exposed. Let's test that.

    const state0 = {
        portfolio: 100000,
        cash: 0,
        accumulatedInflation: 1.0,
        currentBaseNeed: 0,
        currentMonthlyWithdrawal: 0,
        monthIdx: 0
    };
    const inputs0 = {
        stockReturn: Math.log(1.1), // 10% in one month
        bondReturn: 0,
        cryptoReturn: 0,
        inflation: 0
    };
    const config0 = {
        wS: 1, wB: 0, wC: 0,
        INVESTED_AMOUNT: 100000,
        REFILL_CASH_BUFFER: false,
        CASH_BUFFER_TARGET: 0,
        INITIAL_SWR: 0
    };

    const res0 = window.calculateMonthlyStep(state0, inputs0, config0);
    assert("Basic Growth (100k + 10%)", res0.portfolio, 110000, 1.0);

    // --- TEST 2: Cash Shield Logic ---
    // Portfolio drops, Cash exists. Should withdraw from Cash.
    const state1 = {
        portfolio: 100000,
        cash: 5000,
        accumulatedInflation: 1.0,
        currentBaseNeed: 0,
        currentMonthlyWithdrawal: 1000,
        monthIdx: 0
    };
    const inputs1 = {
        stockReturn: Math.log(0.9), // -10% drop
        bondReturn: 0,
        cryptoReturn: 0,
        inflation: 0
    };
    // isMarketDown = true (growth < 1.0)
    const res1 = window.calculateMonthlyStep(state1, inputs1, config0);

    // Portfolio should naturally drop to 90k
    // Cash should allow withdrawal: 5000 -> 4000
    // Portfolio should NOT be withdrawn from: 90000 -> 90000
    assert("Cash Shield: Portfolio preserved (90k)", res1.portfolio, 90000, 1.0);
    assert("Cash Shield: Cash used (4k remain)", res1.cash, 4000, 1.0);
    assert("Cash Shield Flag True", res1.sourcedFromCash ? 1 : 0, 1);
    assert("Market Down Flag True", res1.marketDown ? 1 : 0, 1);

    // --- TEST 3: Cash Shield Fail (Empty Cash) ---
    // Same as above but no cash
    const state2 = { ...state1, cash: 0 };
    const res2 = window.calculateMonthlyStep(state2, inputs1, config0);
    // Portfolio: 90k - 1k withdrawal = 89k
    assert("No Cash: Portfolio withdrawn (89k)", res2.portfolio, 89000, 1.0);
    assert("Cash Shield Flag False", res2.sourcedFromCash ? 1 : 0, 0);


    // --- TEST 4: Fragility Score Calculation ---
    // Mock simulation results
    // 1000 sims. 200 early bad paths.
    // Early Bad Rate = 20%. 
    // Score = rate * 50 = 0.2 * 50 = 10.
    const fragScore = window.calcFragilityScore([], 200, 1000); // wealths array unused in new logic?
    // Wait, calcFragilityScore in simulator.js uses earlyBadPaths / totalSims
    // function calcFragilityScore(wealths, earlyBadPaths, totalSims)

    // Actually, I realized I might have used 'earlyFailRate * 50' which maps 20% to 10.
    // Let's verify.
    // 200 / 1000 = 0.2. 0.2 * 50 = 10. Correct.
    assert("Fragility Score Calculation (20% Fail)", fragScore, 10);

    const fragScore2 = window.calcFragilityScore([], 0, 1000);
    assert("Fragility Score Calculation (0% Fail)", fragScore2, 0);


    // --- TEST 5: Longevity Extension ---
    // Median Final Wealth = 1,000,000
    // Avg Annual Spend = 40,000
    // Sim Years = 30
    // Extra = 1M / 40k = 25 years.
    const longExt = window.calcLongevityExtension(1000000, 40000, 30);
    assert("Longevity Extension (1M / 40k)", longExt, 25);


    console.groupEnd();
    console.log(`🏁 Tests Completed: ${passed} Passed, ${failed} Failed.`);
    return failed === 0;
};
