/**
 * Engine.js - Standard Monthly Geometric Brownian Motion (GBM) Model
 * Includes Stocks, Crypto, Bonds, Inflation, and CoLA Withdrawals.
 */

function generateMarketData(numSims, years, configs) {
    const months = years * 12;
    // We store log returns for each month
    const stockReturns = new Float64Array(numSims * months);
    const bondReturns = new Float64Array(numSims * months);
    const cryptoReturns = new Float64Array(numSims * months);
    const inflationPath = new Float64Array(numSims * months);

    const useLegacyConfig = (key, defaultVal) => configs.hasOwnProperty(key) ? configs[key] : defaultVal;

    // Generation Loop
    for (let s = 0; s < numSims; s++) {
        for (let m = 0; m < months; m++) {
            const idx = s * months + m;
            const t = m / Math.max(1, months - 1); // Progression [0, 1]

            // 1. Inflation (Fixed mean)
            const zI = Stats.randomNormal(0, 1);
            const inflM = (useLegacyConfig('INFL_MEAN', 0.025) / 12) + (useLegacyConfig('INFL_VOL', 0.015) / Math.sqrt(12)) * zI;
            inflationPath[idx] = inflM;

            // 2. Stocks (Interpolated)
            const sCagr = useLegacyConfig('S_CAGR_START', 0.07) * (1 - t) + useLegacyConfig('S_CAGR_END', 0.07) * t;
            const sVol = useLegacyConfig('S_VOL_START', 0.16) * (1 - t) + useLegacyConfig('S_VOL_END', 0.16) * t;
            const sDriftM = Math.log(1 + sCagr) / 12;
            const sVolM = sVol / Math.sqrt(12);
            const zS = Stats.randomNormal(0, 1);
            stockReturns[idx] = sDriftM + sVolM * zS;

            // 3. Bonds (Usually constant)
            const bCagr = useLegacyConfig('B_CAGR_START', 0.045);
            const bVol = useLegacyConfig('B_VOL_START', 0.05);
            const bDriftM = Math.log(1 + bCagr) / 12;
            const bVolM = bVol / Math.sqrt(12);
            const zB = Stats.randomNormal(0, 1);
            bondReturns[idx] = bDriftM + bVolM * zB;

            // 4. Crypto (Interpolated)
            const cCagr = useLegacyConfig('C_CAGR_START', 0.15) * (1 - t) + useLegacyConfig('C_CAGR_END', 0.15) * t;
            const cVol = useLegacyConfig('C_VOL_START', 0.60) * (1 - t) + useLegacyConfig('C_VOL_END', 0.60) * t;
            const cDriftM = Math.log(1 + cCagr) / 12;
            const cVolM = cVol / Math.sqrt(12);
            const zC = Stats.randomNormal(0, 1);
            cryptoReturns[idx] = cDriftM + cVolM * zC;
        }
    }

    return { stocks: stockReturns, bonds: bondReturns, crypto: cryptoReturns, inflation: inflationPath };
}

function simulatePortfolio(withdrawalRate, marketData, configs) {
    const { numSims, years, INVESTED_AMOUNT } = configs;

    // Safety check
    if (!years || years <= 0) {
        console.error("Engine: Invalid 'years' parameter", years);
        return { successRate: 0, wealths: [] };
    }

    const months = years * 12;
    const { stocks, bonds, crypto, inflation } = marketData;

    // Weights (Input is already decimal 0.0 - 1.0 from index.html)
    const wS = configs.ALLOC_STOCKS || 0;
    const wC = configs.ALLOC_CRYPTO || 0;
    const wB = Math.max(0, 1 - wS - wC); // Remainder is Bonds/Cash

    let successCount = 0;

    // Handle "Target Expense" Mode
    let effectiveAnnualWithdrawal = 0;
    if (withdrawalRate < 0) {
        if (configs.TARGET_ANNUAL_EXP) {
            effectiveAnnualWithdrawal = configs.TARGET_ANNUAL_EXP;
        } else {
            console.warn("Engine: Withdrawal Rate < 0 but no TARGET_ANNUAL_EXP defined.");
        }
    } else {
        // [Fixed] SWR should be based on TOTAL CAPITAL (Invested + Cash), not just Invested.
        // This allows correct calculation for 0% Invested portfolios.
        const totalCap = INVESTED_AMOUNT + (configs.CASH_BUFFER || 0);
        effectiveAnnualWithdrawal = totalCap * withdrawalRate;
    }

    // Debug Log
    if (Math.random() < 0.005) {
        console.log(`[Sim] ${years}y, Alloc: S${(wS * 100).toFixed(0)}/C${(wC * 100).toFixed(0)}/B${(wB * 100).toFixed(0)}, WD: ${Math.round(effectiveAnnualWithdrawal)}`);
    }

    const initialAnnualWithdrawal = effectiveAnnualWithdrawal;
    const finalWealths = [];

    // Verify Market Data
    if (!stocks || stocks.length < numSims * months) {
        console.error("Engine: Market Data mismatch.", { req: numSims * months, got: stocks ? stocks.length : 0 });
        return { successRate: 0, wealths: [] };
    }

    for (let s = 0; s < numSims; s++) {
        let portfolio = INVESTED_AMOUNT;
        let cashBalance = configs.CASH_BUFFER || 0;
        let survived = true;

        let currentAnnualWithdrawal = initialAnnualWithdrawal;
        let currentMonthlyWithdrawal = currentAnnualWithdrawal / 12;
        let accumulatedInflation12m = 1.0;

        for (let m = 0; m < months; m++) {
            const idx = s * months + m;

            // 1. Market Factors
            const rLogS = stocks[idx];
            const rLogB = bonds ? bonds[idx] : 0;
            const rLogC = crypto ? crypto[idx] : 0; // Fixed: Read from crypto array

            const inflM = inflation[idx];
            if (isNaN(rLogS)) { survived = false; portfolio = 0; break; }

            accumulatedInflation12m *= (1 + inflM);

            // Correct Growth Factor: P_t = P_{t-1} * (1 + R_weighted_linear)
            const rLinS = Math.exp(rLogS) - 1;
            const rLinB = Math.exp(rLogB) - 1;
            const rLinC = Math.exp(rLogC) - 1;

            // Weighted linear return
            const rLinPort = (wS * rLinS) + (wB * rLinB) + (wC * rLinC);

            const growthFactor = 1 + rLinPort;

            // 2. Apply Growth
            portfolio *= growthFactor;

            // CASH BUFFER LOGIC: "Prime Harvesting" + "Smart Refill"
            let paidFromCash = false;

            // 1. Defend: Use Cash if Market is Down
            if (growthFactor < 1.0 && cashBalance >= currentMonthlyWithdrawal) {
                cashBalance -= currentMonthlyWithdrawal;
                paidFromCash = true;
            } else {
                // 2. Spend: Use Portfolio
                portfolio -= currentMonthlyWithdrawal;

                // 3. Refill: If Portfolio is "Booming" (> 20% gain), refill the buffer
                // Only check refill if we are paying from portfolio (Market is UP or Flat)
                // And only if buffer is depleted.
                const bufferTarget = configs.CASH_BUFFER || 0;
                if (configs.REFILL_CASH_BUFFER && bufferTarget > 0 && cashBalance < bufferTarget) {
                    // Refill Threshold: Only if portfolio is substantial (e.g., > 110% of start)
                    // WHY 110%? 
                    // To prevent "Sequence of Returns" traps. If the market drops to 80% and recovers to 100%, 
                    // the portfolio is still fragile. We should NOT drain it to fill cash yet.
                    // We only "harvest" profits when we are safely above the high-water mark (110% is a conservative safe zone).
                    const refillThreshold = INVESTED_AMOUNT * 1.10;
                    if (portfolio > refillThreshold) {
                        const needed = bufferTarget - cashBalance;
                        const take = Math.min(needed, portfolio - refillThreshold);
                        // Don't take too much at once? Let's take what we can to restore shield.
                        if (take > 0) {
                            portfolio -= take;
                            cashBalance += take;
                        }
                    }
                }
            }

            // NaN Check
            if (isNaN(portfolio)) {
                console.error(`Engine: Portfolio became NaN at sim ${s} month ${m}.`, { rLogS, rLinPort, currentMonthlyWithdrawal });
                survived = false; portfolio = 0; break;
            }

            // 3. Fallback: If portfolio went negative, try to cover from cash
            if (portfolio < 0) {
                const deficit = -portfolio;
                portfolio = 0;

                if (cashBalance >= deficit) {
                    cashBalance -= deficit;
                } else {
                    // Cash exhausted too -> True Ruin
                    cashBalance = 0;
                    survived = false;
                    break;
                }
            }



            // 3. COLA
            if ((m + 1) % 12 === 0) {
                currentAnnualWithdrawal *= accumulatedInflation12m;
                currentMonthlyWithdrawal = currentAnnualWithdrawal / 12;
                accumulatedInflation12m = 1.0;
            }
        }

        if (survived) successCount++;
        finalWealths.push(portfolio);
    }

    return {
        successRate: successCount / numSims,
        wealths: finalWealths
    };
}

// Browser compatibility export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateMarketData, simulatePortfolio };
} else {
    window.generateMarketData = generateMarketData;
    window.simulatePortfolio = simulatePortfolio;
}
