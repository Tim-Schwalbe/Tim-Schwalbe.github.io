// REMOVED IMPORT: getConfig from ../utils/config.js
// DEPENDENCIES: window.Config

/**
 * Simulates portfolio performance over time.
 * @param {number} withdrawalRate - Initial withdrawal rate (decimal). If < 0, uses fixed TARGET_ANNUAL_EXP.
 * @param {object} marketData - Object containing arrays for 'stocks', 'bonds', 'crypto', 'inflation'.
 * @param {object} configs - Configuration object with simulation parameters.
 * @returns {object} - Result object with successRate, wealths array, and stats.
 */
window.simulatePortfolio = function (withdrawalRate, marketData, configs) {
    const { numSims, years, INVESTED_AMOUNT } = configs;
    if (!years || years <= 0) return { successRate: 0, wealths: [] };

    const months = years * 12;
    const { stocks, bonds, crypto, inflation } = marketData;

    const wS = configs.ALLOC_STOCKS || 0;
    const wC = configs.ALLOC_CRYPTO || 0;
    const wB = Math.max(0, 1 - wS - wC);

    // Warning for missing data if allocated
    if (wB > 0 && (!bonds || bonds.length === 0)) {
        console.warn("⚠️ Bonds allocated but market data missing or empty. Returns will be 0.");
    }
    if (wC > 0 && (!crypto || crypto.length === 0)) {
        console.warn("⚠️ Crypto allocated but market data missing or empty. Returns will be 0.");
    }

    let successCount = 0;
    let effectiveAnnualWithdrawal = 0;

    if (withdrawalRate < 0) {
        effectiveAnnualWithdrawal = configs.TARGET_ANNUAL_EXP || 0;
    } else {
        const totalCap = INVESTED_AMOUNT + (configs.CASH_BUFFER || 0);
        effectiveAnnualWithdrawal = totalCap * withdrawalRate;
    }

    const initialAnnualWithdrawal = effectiveAnnualWithdrawal;
    const finalWealths = [];
    const pathStats = {
        maxDrawdowns: [],
        drawdownDurations: [],
        lowestCapitals: [],
        totalSpends: [],
        realFinalWealths: [],
        ceilingHits: 0,
        floorHits: 0,
        maxMonthlyAcrossAll: 0,
        totalSurvivorMonths: 0
    };

    for (let s = 0; s < numSims; s++) {
        let portfolio = INVESTED_AMOUNT;
        let cashBalance = configs.CASH_BUFFER || 0;
        let survived = true;
        let pathSpend = 0;
        let pathInflationFactor = 1.0;

        let peakTotalWealth = portfolio + cashBalance;
        let currentMaxDrawdown = 0;
        let currentDrawdownDuration = 0;
        let maxDrawdownDuration = 0;
        let lowestTotalWealth = peakTotalWealth;

        let currentBaseNeed = initialAnnualWithdrawal;
        let currentMonthlyWithdrawal = initialAnnualWithdrawal / 12;
        let accumulatedInflation12m = 1.0;

        for (let m = 0; m < months; m++) {
            const idx = s * months + m;
            const rLogS = stocks[idx];
            const rLogB = bonds ? bonds[idx] : 0;
            const rLogC = crypto ? crypto[idx] : 0;
            const inflM = inflation[idx];

            if (isNaN(rLogS)) { survived = false; portfolio = 0; break; }

            // Track total path inflation
            pathInflationFactor *= (1 + inflM);

            const stepResult = window.calculateMonthlyStep(
                {
                    portfolio,
                    cash: cashBalance,
                    accumulatedInflation: accumulatedInflation12m,
                    currentBaseNeed,
                    currentMonthlyWithdrawal,
                    monthIdx: m
                },
                {
                    stockReturn: rLogS,
                    bondReturn: rLogB,
                    cryptoReturn: rLogC,
                    inflation: inflM
                },
                {
                    wS, wB, wC,
                    INVESTED_AMOUNT,
                    REFILL_CASH_BUFFER: configs.REFILL_CASH_BUFFER,
                    CASH_BUFFER_TARGET: configs.CASH_BUFFER || 0,
                    CEILING_EARLY: configs.CEILING_EARLY,
                    CEILING_LATE: configs.CEILING_LATE,
                    FLOOR_PCT: configs.FLOOR_PCT,
                    INITIAL_SWR: initialAnnualWithdrawal / (INVESTED_AMOUNT || 1)
                }
            );

            // Update State
            portfolio = stepResult.portfolio;
            cashBalance = stepResult.cash;
            accumulatedInflation12m = stepResult.accumulatedInflation;
            currentBaseNeed = stepResult.currentBaseNeed;
            currentMonthlyWithdrawal = stepResult.currentMonthlyWithdrawal;

            pathSpend += currentMonthlyWithdrawal;
            pathStats.totalSurvivorMonths++;
            if (stepResult.ceilingHit) pathStats.ceilingHits++;
            if (stepResult.floorHit) pathStats.floorHits++;
            pathStats.maxMonthlyAcrossAll = Math.max(pathStats.maxMonthlyAcrossAll, currentMonthlyWithdrawal);

            if (stepResult.failed) {
                cashBalance = 0; survived = false; break;
            }

            // Stats Tracking
            const currentTotalWealth = portfolio + cashBalance;
            if (currentTotalWealth > peakTotalWealth) {
                peakTotalWealth = currentTotalWealth;
                maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDrawdownDuration);
                currentDrawdownDuration = 0;
            } else {
                const dd = (peakTotalWealth - currentTotalWealth) / peakTotalWealth;
                currentMaxDrawdown = Math.max(currentMaxDrawdown, dd);
                currentDrawdownDuration++;
            }
            lowestTotalWealth = Math.min(lowestTotalWealth, currentTotalWealth);
        }

        if (survived) successCount++;
        const finalWealth = portfolio + cashBalance;
        finalWealths.push(finalWealth);
        pathStats.totalSpends.push(pathSpend);
        pathStats.realFinalWealths.push(finalWealth / pathInflationFactor);

        // Save path stats
        pathStats.maxDrawdowns.push(currentMaxDrawdown);
        pathStats.drawdownDurations.push(Math.max(maxDrawdownDuration, currentDrawdownDuration));
        pathStats.lowestCapitals.push(lowestTotalWealth);
    }

    if (!configs.SILENT) {
        logSimulationSummary(configs, initialAnnualWithdrawal, successCount / numSims, wS, wB, wC);
    }

    // Aggregate stats
    const median = arr => {
        if (arr.length === 0) return 0;
        const s = [...arr].sort((a, b) => a - b);
        return s[Math.floor(s.length / 2)];
    };

    const avgTotalSpend = pathStats.totalSpends.reduce((a, b) => a + b, 0) / (pathStats.totalSpends.length || 1);

    return {
        successRate: successCount / numSims,
        wealths: finalWealths,
        stats: {
            medianMaxDrawdown: median(pathStats.maxDrawdowns),
            worstDrawdown: Math.max(...pathStats.maxDrawdowns),
            medianLowestCapital: median(pathStats.lowestCapitals),
            absoluteLowestCapital: Math.min(...pathStats.lowestCapitals),
            medianDrawdownDuration: median(pathStats.drawdownDurations),
            worstDrawdownDuration: Math.max(...pathStats.drawdownDurations),

            // Legacy / Real Wealth
            medianRealFinalWealth: median(pathStats.realFinalWealths),

            // Lifestyle Stats
            medianTotalSpend: median(pathStats.totalSpends),
            avgAnnualSpend: (avgTotalSpend / years),
            medianMonthlySpend: (median(pathStats.totalSpends) / (years * 12)),
            maxMonthlySpend: pathStats.maxMonthlyAcrossAll,
            ceilingHitRate: pathStats.ceilingHits / (pathStats.totalSurvivorMonths || 1),
            floorHitRate: pathStats.floorHits / (pathStats.totalSurvivorMonths || 1)
        }
    };
}

/**
 * calculateMonthlyStep - Standalone engine logic for a single month.
 * Exposing this allows for "Live Code Inspection" and Unit Testing.
 */
/**
 * calculateMonthlyStep - Standalone engine logic for a single month.
 * Exposing this allows for "Live Code Inspection" and Unit Testing.
 * @param {object} state - Current portfolio state (portfolio, cash, accumulatedInflation, etc.)
 * @param {object} inputs - Market returns for this month (stockReturn, bondReturn, etc.)
 * @param {object} config - Static configuration (allocations, invested amount, guardrails)
 * @returns {object} - New state object (portfolio, cash, failed flag, etc.)
 */
window.calculateMonthlyStep = function (state, inputs, config) {
    const { portfolio, cash, accumulatedInflation, currentBaseNeed, currentMonthlyWithdrawal, monthIdx } = state;
    const { stockReturn, bondReturn, cryptoReturn, inflation } = inputs;
    const { wS, wB, wC, INVESTED_AMOUNT, REFILL_CASH_BUFFER, CASH_BUFFER_TARGET, CEILING_EARLY, CEILING_LATE, FLOOR_PCT, INITIAL_SWR } = config;

    // 1. Inflation
    const newInflation = accumulatedInflation * (1 + inflation);

    // 2. Growth
    const rLinPort = (wS * (Math.exp(stockReturn) - 1)) +
        (wB * (Math.exp(bondReturn) - 1)) +
        (wC * (Math.exp(cryptoReturn) - 1));
    const growthFactor = 1 + rLinPort;
    let newPortfolio = portfolio * growthFactor;
    let newCash = cash;

    // 3. Withdrawals (Prime Harvesting)
    const isUnderwater = newPortfolio < INVESTED_AMOUNT;
    const isMarketDown = growthFactor < 1.0;

    if ((isUnderwater || isMarketDown) && newCash >= currentMonthlyWithdrawal) {
        newCash -= currentMonthlyWithdrawal;
    } else {
        newPortfolio -= currentMonthlyWithdrawal;

        // Refill Logic
        if (REFILL_CASH_BUFFER && CASH_BUFFER_TARGET > 0 && newCash < CASH_BUFFER_TARGET) {
            const refillThreshold = INVESTED_AMOUNT * 1.0;
            if (newPortfolio > refillThreshold) {
                const needed = CASH_BUFFER_TARGET - newCash;
                const availableSurplus = newPortfolio - refillThreshold;
                const take = Math.min(needed, availableSurplus);
                if (take > 0.01) {
                    newPortfolio -= take;
                    newCash += take;
                }
            }
        }
    }

    // 4. Bankruptcy Check
    let failed = false;
    if (newPortfolio < 0) {
        const deficit = -newPortfolio;
        newPortfolio = 0;
        if (newCash >= deficit) {
            newCash -= deficit;
        } else {
            newCash = 0;
            failed = true;
        }
    }

    // 5. Annual Adjustment (Spending Updates)
    let newBaseNeed = currentBaseNeed;
    let newAnnualWithdrawal = currentMonthlyWithdrawal * 12; // Default unchanged
    let ceilingHit = false;
    let floorHit = false;

    if ((monthIdx + 1) % 12 === 0) {
        newBaseNeed *= newInflation;

        const yearNum = Math.floor((monthIdx + 1) / 12);
        const ceilingPct = (yearNum <= 10 ? (CEILING_EARLY || 150) : (CEILING_LATE || 150)) / 100;

        const variableSpend = newPortfolio * INITIAL_SWR;
        const maxCap = newBaseNeed * ceilingPct;
        const floorPct = (FLOOR_PCT || 100) / 100;
        const effectiveFloor = newBaseNeed * floorPct;

        if (variableSpend > maxCap) {
            ceilingHit = true;
            newAnnualWithdrawal = maxCap;
        } else if (variableSpend < effectiveFloor) {
            floorHit = true;
            newAnnualWithdrawal = effectiveFloor;
        } else {
            newAnnualWithdrawal = variableSpend;
        }
    }

    return {
        portfolio: newPortfolio,
        cash: newCash,
        accumulatedInflation: ((monthIdx + 1) % 12 === 0) ? 1.0 : newInflation,
        currentBaseNeed: newBaseNeed,
        currentMonthlyWithdrawal: newAnnualWithdrawal / 12,
        failed: failed,
        growthFactor: growthFactor,
        ceilingHit: ceilingHit,
        floorHit: floorHit
    };
}

function logSimulationSummary(configs, initialWithdrawal, successRate, wS, wB, wC) {
    const totalCap = configs.INVESTED_AMOUNT + (configs.CASH_BUFFER || 0);
    const sRate = (successRate * 100).toFixed(1);
    const swr = ((initialWithdrawal / totalCap) * 100).toFixed(2);

    const yrs = configs.years;
    const cap = `${(configs.INVESTED_AMOUNT / 1000).toFixed(0)}k+${((configs.CASH_BUFFER || 0) / 1000).toFixed(0)}k`;
    const spend = `${(initialWithdrawal / 1000).toFixed(1)}k`;
    const allocs = `S:${(wS * 100).toFixed(0)}/B:${(wB * 100).toFixed(0)}/C:${(wC * 100).toFixed(0)}`;
    const rets = `Ret:S${(Config.getConfig(configs, 'S_CAGR_START', 0.103) * 100).toFixed(1)}/B${(Config.getConfig(configs, 'B_CAGR_START', 0.052) * 100).toFixed(1)}/C${(Config.getConfig(configs, 'C_CAGR_START', 0.15) * 100).toFixed(1)}`;
    const vols = `Vol:S${(Config.getConfig(configs, 'S_VOL_START', 0.20) * 100).toFixed(1)}/B${(Config.getConfig(configs, 'B_VOL_START', 0.06) * 100).toFixed(1)}/C${(Config.getConfig(configs, 'C_VOL_START', 0.60) * 100).toFixed(1)}`;
    const inf = `Inf:${(Config.getConfig(configs, 'INFL_MEAN', 0.031) * 100).toFixed(1)}(v${(Config.getConfig(configs, 'INFL_VOL', 0.015) * 100).toFixed(1)})`;
    const tgt = configs.TARGET_SUCCESS_PERCENT ? ` | Tgt:${configs.TARGET_SUCCESS_PERCENT}%` : "";

    console.log(`[SIM_FULL] Yrs:${yrs} | Cap:${cap} | Spend:${spend} | ${allocs} | ${rets} | ${vols} | ${inf}${tgt} => Succ:${sRate}% | SWR:${swr}%`);
}
