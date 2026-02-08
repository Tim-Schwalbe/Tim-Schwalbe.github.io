// DEPENDENCIES: window.Stats, window.Config

/**
 * Generates market data paths using geometric brownian motion and gaussian copula.
 * @param {number} numSims - Number of simulations to generate.
 * @param {number} years - Number of years to simulate.
 * @param {object} configs - Configuration object containing CAGR, Volatility, Correlation params.
 * @returns {object} - Object containing Float64Arrays for stocks, bonds, crypto, inflation.
 */
window.generateMarketData = function (numSims, years, configs) {
    const months = years * 12;
    const stockLogReturns = new Float64Array(numSims * months);
    const bondLogReturns = new Float64Array(numSims * months);
    const cryptoLogReturns = new Float64Array(numSims * months);
    const inflationPath = new Float64Array(numSims * months);

    const seed = Config.getConfig(configs, 'RANDOM_SEED', null);
    Stats.seed(seed);

    // 0. Pre-fetch Configs (Hoist out of loop for performance)
    const INFL_MEAN = Config.getConfig(configs, 'INFL_MEAN', 0.025);
    const INFL_VOL = Config.getConfig(configs, 'INFL_VOL', 0.015);
    const CORR_START = Config.getConfig(configs, 'CORR_START', 0.20);
    const CORR_END = Config.getConfig(configs, 'CORR_END', 0.20);
    const ENFORCE_MAX_BAD_STREAK = Config.getConfig(configs, 'ENFORCE_MAX_BAD_STREAK', false);

    const S_CAGR_START = Config.getConfig(configs, 'S_CAGR_START', 0.080);
    const S_CAGR_END = Config.getConfig(configs, 'S_CAGR_END', 0.080);
    const S_VOL_START = Config.getConfig(configs, 'S_VOL_START', 0.17);
    const S_VOL_END = Config.getConfig(configs, 'S_VOL_END', 0.17);

    const B_CAGR_START = Config.getConfig(configs, 'B_CAGR_START', 0.045);
    const B_VOL_START = Config.getConfig(configs, 'B_VOL_START', 0.06);

    const C_CAGR_START = Config.getConfig(configs, 'C_CAGR_START', 0.15);
    const C_CAGR_END = Config.getConfig(configs, 'C_CAGR_END', 0.15);
    const C_VOL_START = Config.getConfig(configs, 'C_VOL_START', 0.60);
    const C_VOL_END = Config.getConfig(configs, 'C_VOL_END', 0.60);

    const FORCE_CRASH = Config.getConfig(configs, 'FORCE_CRASH', false);
    const CRASH_DURATION = Config.getConfig(configs, 'CRASH_DURATION', 3);

    // Optimize Correlation if constant
    const isConstantCorr = (CORR_START === CORR_END);
    let cachedSqrtRho, cachedSqrtOneMinusRho;
    if (isConstantCorr) {
        const safeRho = Math.max(0, Math.min(1, CORR_START));
        cachedSqrtRho = Math.sqrt(safeRho);
        cachedSqrtOneMinusRho = Math.sqrt(1 - safeRho);
    }

    let totalConstraintHits = 0;
    let maxGlobalBadStreak = 0;

    for (let s = 0; s < numSims; s++) {
        for (let m = 0; m < months; m++) {
            const idx = s * months + m;
            const t = (months > 1) ? m / (months - 1) : 0;

            // 1. Inflation
            const zI = Stats.randomNormal(0, 1);
            const inflM = (INFL_MEAN / 12) + (INFL_VOL / Math.sqrt(12)) * zI;

            // Note: Conventional arithmetic inflation model used here.
            inflationPath[idx] = inflM;

            // 2. Correlation & Asset Returns (Common Shock Model)
            let sqrtRho, sqrtOneMinusRho;

            if (isConstantCorr) {
                sqrtRho = cachedSqrtRho;
                sqrtOneMinusRho = cachedSqrtOneMinusRho;
            } else {
                const rho = CORR_START * (1 - t) + CORR_END * t;
                const safeRho = Math.max(0, Math.min(1, rho));
                sqrtRho = Math.sqrt(safeRho);
                sqrtOneMinusRho = Math.sqrt(1 - safeRho);
            }

            const zCommon = Stats.randomNormal(0, 1);
            const zS_id = Stats.randomNormal(0, 1);
            const zB_id = Stats.randomNormal(0, 1);
            const zC_id = Stats.randomNormal(0, 1);

            // Correlated standard normals
            const zS = sqrtRho * zCommon + sqrtOneMinusRho * zS_id;
            const zB = sqrtRho * zCommon + sqrtOneMinusRho * zB_id;
            const zC = sqrtRho * zCommon + sqrtOneMinusRho * zC_id;

            // Stocks (Log Returns)
            const sCagr = S_CAGR_START * (1 - t) + S_CAGR_END * t;
            const sVol = S_VOL_START * (1 - t) + S_VOL_END * t;

            // DRIFT NOTE:
            // We use `drift = log(1 + CAGR)/12` instead of `drift = log(1+CAGR)/12 - 0.5*vol^2/12`.
            // This simplification aligns the Median path with the input CAGR, which is intuitive for users.
            // A rigorous Geometric Brownian Motion would subtract variance drag, resulting in a lower Median but correct Mean.
            // We stick to the Median-matching convention here.
            stockLogReturns[idx] = (Math.log(1 + sCagr) / 12) + (sVol / Math.sqrt(12)) * zS;

            // Bonds
            const bCagr = B_CAGR_START;
            const bVol = B_VOL_START;
            bondLogReturns[idx] = (Math.log(1 + bCagr) / 12) + (bVol / Math.sqrt(12)) * zB;

            // Crypto
            const cCagr = C_CAGR_START * (1 - t) + C_CAGR_END * t;
            const cVol = C_VOL_START * (1 - t) + C_VOL_END * t;
            cryptoLogReturns[idx] = (Math.log(1 + cCagr) / 12) + (cVol / Math.sqrt(12)) * zC;

            // 3. Forced Crash Stress Test
            if (FORCE_CRASH) {
                // Apply crash logic for the first N years (CRASH_DURATION)
                if (Math.floor(m / 12) < CRASH_DURATION) {
                    const floorS = Config.getConfig(configs, 'CRASH_FLOOR_STOCKS', -0.05);
                    const floorC = Config.getConfig(configs, 'CRASH_FLOOR_CRYPTO', -0.10);
                    const floorB = Config.getConfig(configs, 'CRASH_FLOOR_BONDS', -0.01);

                    stockLogReturns[idx] = Math.min(stockLogReturns[idx], floorS);
                    cryptoLogReturns[idx] = Math.min(cryptoLogReturns[idx], floorC);
                    bondLogReturns[idx] = Math.min(bondLogReturns[idx], floorB);
                }
            }
        }

        if (ENFORCE_MAX_BAD_STREAK) {
            const constraints = applyBadYearsConstraint(s, years, months, stockLogReturns, bondLogReturns, cryptoLogReturns, inflationPath, configs);
            totalConstraintHits += constraints.hits;
            maxGlobalBadStreak = Math.max(maxGlobalBadStreak, constraints.maxStreak);
        }
    }

    return {
        stocks: stockLogReturns,
        bonds: bondLogReturns,
        crypto: cryptoLogReturns,
        inflation: inflationPath,
        info: {
            constraintHits: totalConstraintHits,
            maxStreakEncountered: maxGlobalBadStreak
        }
    };
}

function applyBadYearsConstraint(s, years, months, stockLogReturns, bondLogReturns, cryptoLogReturns, inflationPath, configs) {
    const limitBadYears = Config.getConfig(configs, 'MAX_CONSECUTIVE_BAD_YEARS', 100);
    const result = { hits: 0, maxStreak: 0 };
    if (limitBadYears >= 50) return result;

    const assets = [
        { name: 'stocks', data: stockLogReturns },
        { name: 'bonds', data: bondLogReturns },
        { name: 'crypto', data: cryptoLogReturns }
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
                result.maxStreak = Math.max(result.maxStreak, consecutiveBad);
            } else {
                consecutiveBad = 0;
            }

            if (consecutiveBad > limitBadYears) {
                result.hits++;
                // Boost Logic: Retroactive fix
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
    return result;
}
