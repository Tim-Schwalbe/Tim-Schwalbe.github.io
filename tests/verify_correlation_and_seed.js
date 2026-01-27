
const Stats = require('../js/statistics.js');
global.Stats = Stats;
const { generateMarketData, simulatePortfolio } = require('../js/engine.js');

console.log("🔬 VERIFICATION: Asset Correlation + Seed Control\n");

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

// === SEED CONTROL TESTS ===

runTest("Seed: Same seed produces identical results", () => {
    const cfg = {
        years: 10, numSims: 100, INVESTED_AMOUNT: 1000000, CASH_BUFFER: 0,
        ALLOC_STOCKS: 1, TARGET_ANNUAL_EXP: 40000, RANDOM_SEED: 12345
    };

    const data1 = generateMarketData(100, 10, cfg);
    const data2 = generateMarketData(100, 10, cfg);

    // Compare first 10 stock returns
    for (let i = 0; i < 10; i++) {
        if (Math.abs(data1.stocks[i] - data2.stocks[i]) > 1e-10) {
            return `Return ${i}: ${data1.stocks[i]} !== ${data2.stocks[i]}`;
        }
    }
    return true;
});

runTest("Seed: Different seeds produce different results", () => {
    const cfg1 = {
        years: 10, numSims: 100, INVESTED_AMOUNT: 1000000, CASH_BUFFER: 0,
        ALLOC_STOCKS: 1, TARGET_ANNUAL_EXP: 40000, RANDOM_SEED: 12345
    };
    const cfg2 = { ...cfg1, RANDOM_SEED: 54321 };

    const data1 = generateMarketData(100, 10, cfg1);
    const data2 = generateMarketData(100, 10, cfg2);

    let differences = 0;
    for (let i = 0; i < 10; i++) {
        if (Math.abs(data1.stocks[i] - data2.stocks[i]) > 1e-6) differences++;
    }

    return differences >= 8 ? true : `Only ${differences}/10 returns were different`;
});

runTest("Seed: No seed produces random results", () => {
    const cfg = {
        years: 10, numSims: 100, INVESTED_AMOUNT: 1000000, CASH_BUFFER: 0,
        ALLOC_STOCKS: 1, TARGET_ANNUAL_EXP: 40000
    }; // No RANDOM_SEED

    const data1 = generateMarketData(100, 10, cfg);
    const data2 = generateMarketData(100, 10, cfg);

    let differences = 0;
    for (let i = 0; i < 10; i++) {
        if (Math.abs(data1.stocks[i] - data2.stocks[i]) > 1e-6) differences++;
    }

    return differences >= 8 ? true : `Only ${differences}/10 returns were different (should be random)`;
});

// === CORRELATION TESTS ===

runTest("Correlation: Measured correlation matches input (0.4)", () => {
    const cfg = {
        years: 30, numSims: 5000, INVESTED_AMOUNT: 1000000, CASH_BUFFER: 0,
        ALLOC_STOCKS: 1, TARGET_ANNUAL_EXP: 0, RANDOM_SEED: 42,
        CORR_START: 0.40, CORR_END: 0.40
    }; // Fixed correlation

    const data = generateMarketData(5000, 30, cfg);

    // Calculate empirical correlation between stocks and bonds
    let sumS = 0, sumB = 0, sumSB = 0, sumS2 = 0, sumB2 = 0;
    const n = 5000; // First month of each simulation

    for (let i = 0; i < n; i++) {
        const s = data.stocks[i];
        const b = data.bonds[i];
        sumS += s;
        sumB += b;
        sumSB += s * b;
        sumS2 += s * s;
        sumB2 += b * b;
    }

    const meanS = sumS / n;
    const meanB = sumB / n;
    const covSB = (sumSB / n) - (meanS * meanB);
    const stdS = Math.sqrt((sumS2 / n) - (meanS * meanS));
    const stdB = Math.sqrt((sumB2 / n) - (meanB * meanB));
    const corrSB = covSB / (stdS * stdB);

    const target = 0.40;
    const error = Math.abs(corrSB - target);

    console.log(`   Measured correlation: ${corrSB.toFixed(3)} (Target: ${target}, Error: ${error.toFixed(3)})`);

    return error < 0.05 ? true : `Correlation error ${error.toFixed(3)} too large`;
});

runTest("Correlation: High correlation reduces diversification benefit", () => {
    // 50/50 portfolio: Low correlation should have lower volatility than high correlation

    const cfgLowCorr = {
        years: 20, numSims: 1000, INVESTED_AMOUNT: 1000000, CASH_BUFFER: 0,
        ALLOC_STOCKS: 0.5, ALLOC_CRYPTO: 0, TARGET_ANNUAL_EXP: 50000,
        CORR_START: 0.0, CORR_END: 0.0, RANDOM_SEED: 100
    };

    const cfgHighCorr = {
        ...cfgLowCorr,
        CORR_START: 0.90, CORR_END: 0.90, RANDOM_SEED: 101
    };

    const resLow = simulatePortfolio(-1, generateMarketData(1000, 20, cfgLowCorr), cfgLowCorr);
    const resHigh = simulatePortfolio(-1, generateMarketData(1000, 20, cfgHighCorr), cfgHighCorr);

    // Low correlation should have better success (more diversification)
    const benefit = resLow.successRate - resHigh.successRate;

    console.log(`   Low corr success: ${(resLow.successRate * 100).toFixed(1)}%, High corr: ${(resHigh.successRate * 100).toFixed(1)}%`);
    console.log(`   Diversification benefit: ${(benefit * 100).toFixed(1)}%`);

    return benefit > 0.01 ? true : `Diversification benefit too small: ${(benefit * 100).toFixed(1)}%`;
});

console.log(`\n🏁 SUMMARY: ${passedTests}/${totalTests} Passed.`);

if (failedTests > 0) {
    console.log("❌ SOME TESTS FAILED");
    process.exit(1);
} else {
    console.log("✅ ALL TESTS PASSED");
}
