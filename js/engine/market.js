// REMOVED IMPORTS: Stats from ./stats.js, getConfig from ../utils/config.js
// DEPENDENCIES: window.Stats, window.Config

window.generateMarketData = function (numSims, years, configs) {
    const months = years * 12;
    const stockReturns = new Float64Array(numSims * months);
    const bondReturns = new Float64Array(numSims * months);
    const cryptoReturns = new Float64Array(numSims * months);
    const inflationPath = new Float64Array(numSims * months);

    const seed = Config.getConfig(configs, 'RANDOM_SEED', null);
    Stats.seed(seed);

    // 0. Pre-fetch Configs (Hoist out of loop for performance)
    const INFL_MEAN = Config.getConfig(configs, 'INFL_MEAN', 0.031);
    const INFL_VOL = Config.getConfig(configs, 'INFL_VOL', 0.015);
    const CORR_START = Config.getConfig(configs, 'CORR_START', 0.20);
    const CORR_END = Config.getConfig(configs, 'CORR_END', 0.20);

    const S_CAGR_START = Config.getConfig(configs, 'S_CAGR_START', 0.103);
    const S_CAGR_END = Config.getConfig(configs, 'S_CAGR_END', 0.103);
    const S_VOL_START = Config.getConfig(configs, 'S_VOL_START', 0.20);
    const S_VOL_END = Config.getConfig(configs, 'S_VOL_END', 0.20);

    const B_CAGR_START = Config.getConfig(configs, 'B_CAGR_START', 0.052);
    const B_VOL_START = Config.getConfig(configs, 'B_VOL_START', 0.06);

    const C_CAGR_START = Config.getConfig(configs, 'C_CAGR_START', 0.15);
    const C_CAGR_END = Config.getConfig(configs, 'C_CAGR_END', 0.15);
    const C_VOL_START = Config.getConfig(configs, 'C_VOL_START', 0.60);
    const C_VOL_END = Config.getConfig(configs, 'C_VOL_END', 0.60);

    const FORCE_CRASH = Config.getConfig(configs, 'FORCE_CRASH', false);
    const CRASH_DURATION = Config.getConfig(configs, 'CRASH_DURATION', 3);

    for (let s = 0; s < numSims; s++) {
        for (let m = 0; m < months; m++) {
            const idx = s * months + m;
            const t = m / Math.max(1, months - 1);

            // 1. Inflation
            const zI = Stats.randomNormal(0, 1);
            const inflM = (INFL_MEAN / 12) + (INFL_VOL / Math.sqrt(12)) * zI;
            inflationPath[idx] = inflM;

            // 2. Correlation & Asset Returns
            const corrCoef = CORR_START * (1 - t) + CORR_END * t;
            const corrMatrix = [
                [1.0, corrCoef, corrCoef],
                [corrCoef, 1.0, corrCoef],
                [corrCoef, corrCoef, 1.0]
            ];
            const L = Stats.choleskyDecomposition(corrMatrix);
            const z = [Stats.randomNormal(0, 1), Stats.randomNormal(0, 1), Stats.randomNormal(0, 1)];

            const zS = L[0][0] * z[0];
            const zB = L[1][0] * z[0] + L[1][1] * z[1];
            const zC = L[2][0] * z[0] + L[2][1] * z[1] + L[2][2] * z[2];

            // Stocks
            const sCagr = S_CAGR_START * (1 - t) + S_CAGR_END * t;
            const sVol = S_VOL_START * (1 - t) + S_VOL_END * t;
            stockReturns[idx] = (Math.log(1 + sCagr) / 12) + (sVol / Math.sqrt(12)) * zS;

            // Bonds
            const bCagr = B_CAGR_START;
            const bVol = B_VOL_START;
            bondReturns[idx] = (Math.log(1 + bCagr) / 12) + (bVol / Math.sqrt(12)) * zB;

            // Crypto
            const cCagr = C_CAGR_START * (1 - t) + C_CAGR_END * t;
            const cVol = C_VOL_START * (1 - t) + C_VOL_END * t;
            cryptoReturns[idx] = (Math.log(1 + cCagr) / 12) + (cVol / Math.sqrt(12)) * zC;

            // 3. Forced Crash Stress Test
            if (FORCE_CRASH) {
                if (Math.floor(m / 12) < CRASH_DURATION) {
                    if (stockReturns[idx] > 0) stockReturns[idx] = -Math.abs(stockReturns[idx]) * 1.5;
                    if (cryptoReturns[idx] > 0) cryptoReturns[idx] = -Math.abs(cryptoReturns[idx]) * 2.0;
                    if (bondReturns[idx] > 0) bondReturns[idx] = -Math.abs(bondReturns[idx]) * 0.5;
                }
            }
        }

        // 4. Max Consecutive Bad Years Constraint
        applyBadYearsConstraint(s, years, months, stockReturns, bondReturns, cryptoReturns, inflationPath, configs);
    }

    return { stocks: stockReturns, bonds: bondReturns, crypto: cryptoReturns, inflation: inflationPath };
}

function applyBadYearsConstraint(s, years, months, stockReturns, bondReturns, cryptoReturns, inflationPath, configs) {
    const limitBadYears = Config.getConfig(configs, 'MAX_CONSECUTIVE_BAD_YEARS', 100);
    if (limitBadYears >= 50) return;

    const assets = [
        { name: 'stocks', data: stockReturns },
        { name: 'bonds', data: bondReturns },
        { name: 'crypto', data: cryptoReturns }
    ];

    for (const asset of assets) {
        let consecutiveBad = 0;
        for (let y = 0; y < years; y++) {
            const yearStartIdx = s * months + y * 12;
            let annualGrowth = 1.0;
            let annualInflation = 1.0;

            for (let k = 0; k < 12; k++) {
                const i = yearStartIdx + k;
                annualGrowth *= Math.exp(asset.data[i]);
                annualInflation *= (1 + inflationPath[i]);
            }

            if (annualGrowth < annualInflation) {
                consecutiveBad++;
            } else {
                consecutiveBad = 0;
            }

            if (consecutiveBad > limitBadYears) {
                const targetGrowth = annualInflation * 1.02;
                const requiredBoost = Math.log(targetGrowth) - Math.log(annualGrowth);
                const monthlyBoost = requiredBoost / 12;
                for (let k = 0; k < 12; k++) {
                    asset.data[yearStartIdx + k] += monthlyBoost;
                }
                consecutiveBad = 0;
            }
        }
    }
}
