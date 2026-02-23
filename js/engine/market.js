// DEPENDENCIES: window.Stats, window.Config

/**
 * Generates market data paths using geometric brownian motion and gaussian copula.
 * @param {number} numSims - Number of simulations to generate.
 * @param {number} years - Number of years to simulate.
 * @param {object} configs - Configuration object containing CAGR, Volatility, Correlation params.
 * @returns {object} - Object containing Float64Arrays for stocks, bonds, crypto, inflation.
 */
window.generateMarketData = async function (numSims, years, configs) {
    const months = years * 12;
    const stockLogReturns = new Float64Array(numSims * months);
    const bondLogReturns = new Float64Array(numSims * months);
    const cryptoLogReturns = new Float64Array(numSims * months);
    const inflationPath = new Float64Array(numSims * months);

    const seed = Config.getConfig(configs, 'RANDOM_SEED', null);
    Stats.seed(seed);

    // 0. Pre-fetch Configs
    const INFL_MEAN = Config.getConfig(configs, 'INFL_MEAN', 0.025);
    const INFL_VOL = Config.getConfig(configs, 'INFL_VOL', 0.015);

    // V6 Fix: Dynamic Correlation Defaults (0.05 -> 0.40)
    const CORR_START = Config.getConfig(configs, 'CORR_START', 0.05);
    const CORR_END = Config.getConfig(configs, 'CORR_END', 0.40);

    const ENFORCE_MAX_BAD_STREAK = Config.getConfig(configs, 'ENFORCE_MAX_BAD_STREAK', false);

    const S_CAGR_START = Config.getConfig(configs, 'S_CAGR_START', 0.080);
    const S_CAGR_END = Config.getConfig(configs, 'S_CAGR_END', 0.080);
    const S_VOL_START = Config.getConfig(configs, 'S_VOL_START', 0.17);
    const S_VOL_END = Config.getConfig(configs, 'S_VOL_END', 0.17);

    const B_CAGR_START = Config.getConfig(configs, 'B_CAGR_START', 0.045);
    const B_VOL_START = Config.getConfig(configs, 'B_VOL_START', 0.06);

    // V4: Explicit Empirical Defaults (2013-2024)
    const C_CAGR_START = Config.getConfig(configs, 'C_CAGR_START', 1.00);
    const C_CAGR_END = Config.getConfig(configs, 'C_CAGR_END', 0.60);
    const C_VOL_START = Config.getConfig(configs, 'C_VOL_START', 0.75);
    const C_VOL_END = Config.getConfig(configs, 'C_VOL_END', 0.75);

    const HALVING_BOOST = Config.getConfig(configs, 'HALVING_BOOST', 0.20);
    const REVERSION_STRENGTH = Config.getConfig(configs, 'REVERSION_STRENGTH', 0.05);

    const FORCE_CRASH = Config.getConfig(configs, 'FORCE_CRASH', false);
    const CRASH_DURATION = Config.getConfig(configs, 'CRASH_DURATION', 3);

    // Optimize Correlation if constant (Only if no panic logic used? No, panic logic overrides)
    // We will calculate dynamically now for V6 accuracy.

    let totalConstraintHits = 0;
    let maxGlobalBadStreak = 0;

    for (let s = 0; s < numSims; s++) {
        if (s > 0 && s % 500 === 0 && typeof setTimeout !== 'undefined') await new Promise(r => setTimeout(r, 0));
        let prevCryptoReturn = 0;

        for (let m = 0; m < months; m++) {
            const idx = s * months + m;
            const t = (months > 1) ? m / (months - 1) : 0;

            const zI = Stats.randomNormal(0, 1);
            const inflLogRet = (Math.log(1 + INFL_MEAN) / 12) + (INFL_VOL / Math.sqrt(12)) * zI;
            const inflM = Math.exp(inflLogRet) - 1;
            inflationPath[idx] = inflM;

            // --- V6: Realistic 4-Year Cycle Math (Deterministic Macros) ---
            const useCycles = Config.getConfig(configs, 'USE_FAT_TAILS', true);
            const limitCycles10y = Config.getConfig(configs, 'LIMIT_FAT_TAILS_10Y', false);
            const applyCycles = useCycles && (!limitCycles10y || m < 120);

            const cCagrTarget = C_CAGR_START * (1 - t) + C_CAGR_END * t;
            const cVolTarget = C_VOL_START * (1 - t) + C_VOL_END * t;

            let cycleDriftAdder = 0;
            let targetVolMonthly = cVolTarget / Math.sqrt(12);
            let isMacroBear = false;

            const START_IN_BEAR_MARKET = Config.getConfig(configs, 'START_IN_BEAR_MARKET', false);
            if (applyCycles) {
                const cycleOffset = START_IN_BEAR_MARKET ? 18 : 0;
                const cycleMonth = (m + cycleOffset) % 48;

                // Target performance for this exact 4-year window based on the user's CAGR settings
                const cycleMultiplier = Math.pow(1 + cCagrTarget, 4);

                // Historically, peak multipliers are massive but scale with target CAGR
                const peakMult = Math.max(cycleMultiplier * 2.0, 4.0);

                // Configurable Bear Market Drop (Default -75%)
                const bearDepth = Config.getConfig(configs, 'BEAR_MARKET_DEPTH', -0.75);
                const troughMult = peakMult * (1 + bearDepth);

                // Phase 1: Bull Market (Months 0 - 17, 18 months)
                if (cycleMonth < 18) {
                    const requiredMonthlyDrift = Math.log(peakMult) / 18.0;
                    cycleDriftAdder = requiredMonthlyDrift - (Math.log(1 + cCagrTarget) / 12);
                }
                // Phase 2: Bear Market (Months 18 - 29, 12 months)
                else if (cycleMonth < 30) {
                    const requiredMonthlyDrift = Math.log(1 + bearDepth) / 12.0;
                    cycleDriftAdder = requiredMonthlyDrift - (Math.log(1 + cCagrTarget) / 12);
                    isMacroBear = true;
                    // Bear markets are highly volatile
                    targetVolMonthly = Math.max(targetVolMonthly, 0.90 / Math.sqrt(12));
                }
                // Phase 3: Recovery/Sideways (Months 30 - 47, 18 months)
                else {
                    const requiredMonthlyDrift = Math.log(cycleMultiplier / troughMult) / 18.0;
                    cycleDriftAdder = requiredMonthlyDrift - (Math.log(1 + cCagrTarget) / 12);
                }
            }

            // Correlation (Spike in macro panic)
            let rho = CORR_START * (1 - t) + CORR_END * t;
            if (isMacroBear) {
                rho = Math.max(rho, 0.80);
            }
            const safeRho = Math.max(0, Math.min(1, rho));
            const sqrtRho = Math.sqrt(safeRho);
            const sqrtOneMinusRho = Math.sqrt(1 - safeRho);

            // Common Shock
            const zCommon = Stats.randomNormal(0, 1);
            const zS_id = Stats.randomNormal(0, 1);
            const zB_id = Stats.randomNormal(0, 1);

            const zS = sqrtRho * zCommon + sqrtOneMinusRho * zS_id;
            const zB = sqrtRho * zCommon + sqrtOneMinusRho * zB_id;

            // Stocks
            const sCagr = S_CAGR_START * (1 - t) + S_CAGR_END * t;
            const sVol = S_VOL_START * (1 - t) + S_VOL_END * t;
            const sDrag = 0; // Match Median (User setting historical norm)
            stockLogReturns[idx] = (Math.log(1 + sCagr) / 12 - sDrag / 12) + (sVol / Math.sqrt(12)) * zS;

            // Bonds
            const bCagr = B_CAGR_START;
            const bVol = B_VOL_START;
            const bDrag = 0; // Match Median
            bondLogReturns[idx] = (Math.log(1 + bCagr) / 12 - bDrag / 12) + (bVol / Math.sqrt(12)) * zB;

            // Crypto parameters
            const cDrag = 0; // Match Median (User setting historical norm, same as Stocks/Bonds)
            const cDriftBase = Math.log(1 + cCagrTarget) / 12 - cDrag / 12;

            // Effective Drift
            let effectiveDrift = cDriftBase + cycleDriftAdder;

            // Crypto Shock
            let finalZ;
            if (applyCycles && isMacroBear) {
                // Fatter tails in bear markets
                const zC_id_t = Stats.randomT(3);
                finalZ = sqrtRho * zCommon + sqrtOneMinusRho * zC_id_t;
                // Scale targetVolMonthly to account for T-distribution variance boost
                const stdBoost = Math.sqrt(3 - 2 * safeRho);
                if (stdBoost > 0) targetVolMonthly /= stdBoost;
            } else {
                const zC_id = Stats.randomNormal(0, 1);
                finalZ = sqrtRho * zCommon + sqrtOneMinusRho * zC_id;
            }

            cryptoLogReturns[idx] = effectiveDrift + targetVolMonthly * finalZ;

            // Clamping
            const MIN_LOG_RET = -2.30;
            const MAX_LOG_RET = 3.05;
            cryptoLogReturns[idx] = Math.max(MIN_LOG_RET, Math.min(MAX_LOG_RET, cryptoLogReturns[idx]));

            // Forced Crash
            if (FORCE_CRASH && Math.floor(m / 12) < CRASH_DURATION) {
                const floorS = Config.getConfig(configs, 'CRASH_FLOOR_STOCKS', -0.20);
                const floorB = Config.getConfig(configs, 'CRASH_FLOOR_BONDS', -0.05);
                stockLogReturns[idx] = Math.min(stockLogReturns[idx], floorS);
                bondLogReturns[idx] = Math.min(bondLogReturns[idx], floorB);
            }
        }

        if (ENFORCE_MAX_BAD_STREAK) {
            const constraints = applyBadYearsConstraint(s, years, months, stockLogReturns, bondLogReturns, cryptoLogReturns, inflationPath, configs);
            totalConstraintHits += constraints.hits;
            maxGlobalBadStreak = Math.max(maxGlobalBadStreak, constraints.maxStreak);
        }
    }

    // V5: Enhanced Empirical Stats Validation
    if (!configs.SILENT && numSims > 0) {
        const sampleCount = Math.min(numSims, 20);
        let sumCagr = 0, sumVol = 0, sumCorrSB = 0;

        for (let s = 0; s < sampleCount; s++) {
            const logC = cryptoLogReturns.subarray(s * months, (s + 1) * months);
            let meanC = 0;
            for (let v of logC) meanC += v;
            meanC /= months;

            let varC = 0;
            for (let v of logC) varC += (v - meanC) ** 2;
            varC /= months;

            sumCagr += Math.exp(meanC * 12) - 1;
            sumVol += Math.sqrt(varC * 12);

            // Sample S-C Correlation (Path 0 only to fit in loop or all?)
            // Let's do all in sample
            const logS = stockLogReturns.subarray(s * months, (s + 1) * months);
            let meanS = 0; for (let v of logS) meanS += v; meanS /= months;

            let cov = 0, varS = 0;
            for (let i = 0; i < months; i++) {
                cov += (logC[i] - meanC) * (logS[i] - meanS);
                varS += (logS[i] - meanS) ** 2;
            }
            // Avoid div/0
            if (varC > 0 && varS > 0) {
                sumCorrSB += (cov / months) / (Math.sqrt(varC) * Math.sqrt(varS));
            }
        }

        console.log(`[V5 Crypto Stats Sample N=${sampleCount}] Avg CAGR: ${(sumCagr / sampleCount * 100).toFixed(1)}% | Avg Ann Vol: ${(sumVol / sampleCount * 100).toFixed(1)}% | Avg S-C Corr: ${(sumCorrSB / sampleCount).toFixed(2)}`);
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
