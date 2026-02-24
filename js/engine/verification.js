
/**
 * verification.js
 * Logic for the "Live Verification" widgets in the Methodology section.
 * Allows users to test individual components of the simulation engine.
 */

window.Verification = {

    // TEST 1: Single Year Random Walk (GBM)
    // Inputs: Mean (CAGR), Volatility, Start Value
    testGBM: function (cagr, vol, startValue) {
        // Use the same logic as market.js line 65: 
        // return = (ln(1+cagr)/12) + (vol/sqrt(12)) * Z
        // We simulate 1 year (12 months)
        const dt = 1 / 12;
        let price = startValue;
        const path = [price];

        for (let i = 0; i < 12; i++) {
            const z = window.Stats.randomNormal(0, 1);
            // Monthly mu (drift)
            const mu = Math.log(1 + cagr) / 12;
            // Monthly sigma
            const sigma = vol / Math.sqrt(12);

            // Log return
            const rLog = mu + sigma * z;
            price *= Math.exp(rLog);
            path.push(price);
        }

        return {
            finalPrice: price,
            returnPct: (price - startValue) / startValue,
            path: path
        };
    },

    // TEST 2: Correlation Matrix Generator
    // Inputs: Correlation Coefficient (0 to 1)
    // Output: 1000 pairs of Correlated Random Variables, calculate observed correlation
    testCorrelation: function (targetCorr) {
        const n = 2000;
        const x = [];
        const y = [];

        // Cholesky logic from market.js lines 49-55
        // Matrix: [[1, p], [p, 1]]
        // L = [[1, 0], [p, sqrt(1-p^2)]]
        const p = targetCorr;
        const L00 = 1;
        const L10 = p;
        const L11 = Math.sqrt(1 - p * p);

        for (let i = 0; i < n; i++) {
            const z1 = window.Stats.randomNormal(0, 1);
            const z2 = window.Stats.randomNormal(0, 1);

            const val1 = L00 * z1; // Correlated X
            const val2 = L10 * z1 + L11 * z2; // Correlated Y

            x.push(val1);
            y.push(val2);
        }

        // Calculate Pearson Correlation of samples
        const calcCorr = this._calculatePearson(x, y);

        return {
            target: targetCorr,
            observed: calcCorr,
            samples: x.map((v, i) => ({ x: v, y: y[i] })).slice(0, 100) // Return subset for plotting if needed
        };
    },

    // TEST 3: Inflation Impact
    // Inputs: Cash Amount, Inflation Rate, Years
    testInflation: function (cash, inflationRate, years) {
        const nominal = cash;
        let realValue = cash;

        // Compound decay
        const discountFactor = Math.pow(1 + inflationRate, years);
        realValue = cash / discountFactor;

        return {
            nominal: nominal,
            real: realValue,
            loss: nominal - realValue
        };
    },

    // Helper: Pearson Correlation
    _calculatePearson: function (x, y) {
        const n = x.length;
        if (n === 0) return 0;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
        const sumX2 = x.reduce((a, b) => a + b * b, 0);
        const sumY2 = y.reduce((a, b) => a + b * b, 0);

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

        return (denominator === 0) ? 0 : numerator / denominator;
    },

    // --- CODE INSPECTOR WRAPPERS ---
    // These functions expose internal engine logic for the "Live Inspector" UI
    inspectors: {
        runRandomNormal: function (mean, std) {
            return window.Stats.randomNormal(mean, std);
        },
        runCholesky: function (rho) {
            const matrix = [[1, rho, rho], [rho, 1, rho], [rho, rho, 1]];
            return window.Stats.choleskyDecomposition(matrix);
        },
        runMarketStep: function (cagr, vol) {
            // Simulate 1 month return using the exact formula from market.js
            const z = window.Stats.randomNormal(0, 1);
            const mu = Math.log(1 + cagr) / 12;
            const sigma = vol / Math.sqrt(12);
            return mu + sigma * z; // Log Return
        },
        runSimStep: function (portfolio, cash, needs, wS, wB, wC, sRet, bRet, cRet, infl) {
            // Wrapper for window.calculateMonthlyStep
            const state = {
                portfolio: portfolio,
                cash: cash,
                accumulatedInflation: 1.0, // Simplification for single step test
                currentBaseNeed: needs,
                currentMonthlyWithdrawal: needs / 12,
                monthIdx: 5 // Arbitrary mid-year month to avoid annual reset trigger for this simple test
            };
            const inputs = {
                stockReturn: Math.log(1 + sRet), // Convert linear to log for input
                bondReturn: Math.log(1 + bRet),
                cryptoReturn: Math.log(1 + cRet),
                inflation: infl
            };
            const config = {
                wS, wB, wC,
                INVESTED_AMOUNT: 1000000, // Hardcoded reference for "Underwater" check
                REFILL_CASH_BUFFER: true,
                CASH_BUFFER_TARGET: 0, // Disable buffer logic for simple test or make input? Let's assume standard no-buffer for basic check
                CEILING_EARLY: 150, CEILING_LATE: 150, FLOOR_PCT: 100, INITIAL_SWR: 0.04
            };

            return window.calculateMonthlyStep(state, inputs, config);
        }
    }
};
