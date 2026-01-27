// REMOVED IMPORT: getConfig from ../utils/config.js
// DEPENDENCIES: window.Config

window.simulatePortfolio = function (withdrawalRate, marketData, configs) {
    const { numSims, years, INVESTED_AMOUNT } = configs;
    if (!years || years <= 0) return { successRate: 0, wealths: [] };

    const months = years * 12;
    const { stocks, bonds, crypto, inflation } = marketData;

    const wS = configs.ALLOC_STOCKS || 0;
    const wC = configs.ALLOC_CRYPTO || 0;
    const wB = Math.max(0, 1 - wS - wC);

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

    for (let s = 0; s < numSims; s++) {
        let portfolio = INVESTED_AMOUNT;
        let cashBalance = configs.CASH_BUFFER || 0;
        let survived = true;

        let currentAnnualWithdrawal = initialAnnualWithdrawal;
        let currentBaseNeed = initialAnnualWithdrawal;
        let currentMonthlyWithdrawal = currentAnnualWithdrawal / 12;
        let accumulatedInflation12m = 1.0;

        for (let m = 0; m < months; m++) {
            const idx = s * months + m;
            const rLogS = stocks[idx];
            const rLogB = bonds ? bonds[idx] : 0;
            const rLogC = crypto ? crypto[idx] : 0;
            const inflM = inflation[idx];

            if (isNaN(rLogS)) { survived = false; portfolio = 0; break; }

            accumulatedInflation12m *= (1 + inflM);
            const rLinPort = (wS * (Math.exp(rLogS) - 1)) + (wB * (Math.exp(rLogB) - 1)) + (wC * (Math.exp(rLogC) - 1));
            const growthFactor = 1 + rLinPort;
            portfolio *= growthFactor;

            const isUnderwater = portfolio < INVESTED_AMOUNT;
            const isMarketDown = growthFactor < 1.0;

            if ((isUnderwater || isMarketDown) && cashBalance >= currentMonthlyWithdrawal) {
                cashBalance -= currentMonthlyWithdrawal;
            } else {
                portfolio -= currentMonthlyWithdrawal;
                const bufferTarget = configs.CASH_BUFFER || 0;
                if (configs.REFILL_CASH_BUFFER && bufferTarget > 0 && cashBalance < bufferTarget) {
                    const refillThreshold = INVESTED_AMOUNT * 1.0;
                    if (portfolio > refillThreshold) {
                        const needed = bufferTarget - cashBalance;
                        const availableSurplus = portfolio - refillThreshold;
                        const take = Math.min(needed, availableSurplus);
                        if (take > 0.01) {
                            portfolio -= take;
                            cashBalance += take;
                        }
                    }
                }
            }

            if (portfolio < 0) {
                const deficit = -portfolio;
                portfolio = 0;
                if (cashBalance >= deficit) {
                    cashBalance -= deficit;
                } else {
                    cashBalance = 0; survived = false; break;
                }
            }

            if ((m + 1) % 12 === 0) {
                // Update Inflation Trackers
                currentBaseNeed *= accumulatedInflation12m;

                // Determine Ceiling % for this year
                const yearNum = Math.floor((m + 1) / 12);
                const ceilingPct = (yearNum <= 10
                    ? (configs.CEILING_EARLY || 150)
                    : (configs.CEILING_LATE || 150)) / 100;

                // Calculate Upside Potential (Variable Portion)
                // If portfolio grew, 4% (or initial rate) of NEW portfolio is > base need.
                const initialSWR = initialAnnualWithdrawal / (INVESTED_AMOUNT || 1);
                const variableSpend = portfolio * initialSWR;
                const maxCap = currentBaseNeed * ceilingPct;

                // Decision Logic:
                // 1. FLOOR: Respect Min Spend % (Default 100% = Inflation Adjusted Base)
                // 2. UPSIDE: Spend Variable Amount if higher...
                // 3. CAP: ...but limit it to Ceiling.

                const floorPct = (configs.FLOOR_PCT || 100) / 100;
                const effectiveFloor = currentBaseNeed * floorPct;

                currentAnnualWithdrawal = Math.max(
                    effectiveFloor,
                    Math.min(variableSpend, maxCap)
                );

                currentMonthlyWithdrawal = currentAnnualWithdrawal / 12;
                accumulatedInflation12m = 1.0;
            }
        }

        if (survived) successCount++;
        finalWealths.push(portfolio);
    }

    if (!configs.SILENT) {
        logSimulationSummary(configs, initialAnnualWithdrawal, successCount / numSims, wS, wB, wC);
    }

    return { successRate: successCount / numSims, wealths: finalWealths };
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
