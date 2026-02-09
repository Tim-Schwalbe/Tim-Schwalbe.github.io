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
        let monthsSinceCrash = 100; // Initialize recovery counter (safe default)

        for (let m = 0; m < months; m++) {
            const idx = s * months + m;
            const t = (months > 1) ? m / (months - 1) : 0;


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

            // Fat Tail Logic for Crypto (3-Regime Model)
            const useFatTails = Config.getConfig(configs, 'USE_FAT_TAILS', true);
            const useMoonshots = Config.getConfig(configs, 'USE_MOONSHOTS', true);
            const probCrash = Config.getConfig(configs, 'PROB_CRASH', 0.05);
            const probMoonshotBase = Config.getConfig(configs, 'PROB_MOONSHOT', 0.05);

            let zC_final = zC; // Default to Standard Normal (Regime 1)

            if (useFatTails) {
                // REGIME 2: CRASH (The "Idiosyncratic Shock")
                // Independent roll for crash event
                const isCrashMonth = Stats.random() < probCrash;

                if (isCrashMonth) {
                    // Force strictly negative shock (Crypto Winter)
                    // OLD LOGIC: -|N(2.5, 1.5)| * 1.5
                    // NEW LOGIC: Uniform random drop between MIN and MAX config
                    const crashMin = Config.getConfig(configs, 'CRASH_MAG_MIN', 0.30);
                    const crashMax = Config.getConfig(configs, 'CRASH_MAG_MAX', 0.60);
                    const dropPct = crashMin + (crashMax - crashMin) * Stats.random();

                    // Convert % drop to log return: log(1 - drop)
                    // Formula: ret = drift + vol * z
                    // z = (ret - drift) / vol
                    const targetLogReturn = Math.log(1 - dropPct);
                    const drift = (Math.log(1 + cCagr) / 12);
                    const volTerm = (cVol / Math.sqrt(12));

                    zC_final = (targetLogReturn - drift) / volTerm;

                    // Reset recovery counter
                    monthsSinceCrash = 0;
                }
                else if (useMoonshots) {
                    // REGIME 3: MOONSHOT (The "Rubber Band" Recovery)
                    // Probability increases if we are in "Recovery Window" (post-crash)
                    let currentProbMoonshot = probMoonshotBase;

                    // "Rubber Band" Effect: Increase odds of moonshot in first 12 months after a crash
                    // Tuned to avoid excessive alpha (was 24m / 2x)
                    if (monthsSinceCrash < 12) {
                        currentProbMoonshot = probMoonshotBase * 1.5;
                    }

                    const isMoonshotMonth = Stats.random() < currentProbMoonshot;

                    if (isMoonshotMonth) {
                        // Positive Skew: 
                        // OLD LOGIC: +|N(2.0, 1.0)| * 1.5
                        // NEW LOGIC: Uniform random rally between MIN and MAX config
                        const moonMin = Config.getConfig(configs, 'MOONSHOT_MAG_MIN', 0.20);
                        const moonMax = Config.getConfig(configs, 'MOONSHOT_MAG_MAX', 0.50);
                        const rallyPct = moonMin + (moonMax - moonMin) * Stats.random();

                        // Convert % rally to log return: log(1 + rally)
                        const targetLogReturn = Math.log(1 + rallyPct);
                        const drift = (Math.log(1 + cCagr) / 12);
                        const volTerm = (cVol / Math.sqrt(12));

                        zC_final = (targetLogReturn - drift) / volTerm;
                    } else {
                        // DAMPEN normal component to avoid tail double-counting
                        // We want "Skinny Peak" (Leptokurtic) distribution.
                        // Since we have added significant variance via Crashes and Moonshots,
                        // we reduce the "background noise" variance.
                        zC_final = zC * 0.55;
                    }

                    if (!isCrashMonth) monthsSinceCrash++;
                }
            } else {
                // If Fat Tails disabled, reset counter just in case
                monthsSinceCrash = 100;
            }

            cryptoLogReturns[idx] = (Math.log(1 + cCagr) / 12) + (cVol / Math.sqrt(12)) * zC_final;

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
