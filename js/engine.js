/**
 * Engine.js - Standard Monthly Geometric Brownian Motion (GBM) Model
 * Includes Stocks, Crypto, Bonds, Inflation, and CoLA Withdrawals.
 */

function generateMarketData(numSims, years, configs) {
    const months = years * 12;
    // We store log returns for each month
    const stockReturns = new Float64Array(numSims * months);
    const bondReturns = new Float64Array(numSims * months);
    const inflationPath = new Float64Array(numSims * months);

    const useLegacyConfig = (key, defaultVal) => configs.hasOwnProperty(key) ? configs[key] : defaultVal;

    // 1. Convert Annual Inputs to Monthly Parameters
    // Stocks
    const sCagr = useLegacyConfig('S_CAGR_START', 0.07); // ~7% Real/Nominal? Default 7%
    const sVol = useLegacyConfig('S_VOL_START', 0.16);
    const sDriftM = Math.log(1 + sCagr) / 12;
    const sVolM = sVol / Math.sqrt(12);

    // Bonds (Monthly)
    const bCagr = useLegacyConfig('B_CAGR_START', 0.045); // ~4.5% Nominal
    const bVol = useLegacyConfig('B_VOL_START', 0.05);    // ~5% Vol
    const bDriftM = Math.log(1 + bCagr) / 12;
    const bVolM = bVol / Math.sqrt(12);

    // Inflation
    const inflMean = useLegacyConfig('INFL_MEAN', 0.025);
    const inflVol = useLegacyConfig('INFL_VOL', 0.015);
    const inflMeanM = inflMean / 12;
    const inflVolM = inflVol / Math.sqrt(12);

    // Generation Loop
    for (let s = 0; s < numSims; s++) {
        for (let m = 0; m < months; m++) {
            const idx = s * months + m;

            // 1. Inflation
            const zI = Stats.randomNormal(0, 1);
            const inflM = inflMeanM + inflVolM * zI;
            inflationPath[idx] = inflM;

            // 2. Stocks (GBM)
            // Log Return = Drift_m + Vol_m * Z
            const zS = Stats.randomNormal(0, 1);
            const logRetS = sDriftM + sVolM * zS;
            stockReturns[idx] = logRetS;

            // 3. Bonds (GBM)
            const zB = Stats.randomNormal(0, 1);
            const logRetB = bDriftM + bVolM * zB;
            bondReturns[idx] = logRetB;
        }
    }

    return { stocks: stockReturns, bonds: bondReturns, inflation: inflationPath };
}

function simulatePortfolio(withdrawalRate, marketData, configs) {
    const { numSims, years, INVESTED_AMOUNT } = configs;

    // Safety check
    if (!years || years <= 0) {
        console.error("Engine: Invalid 'years' parameter", years);
        return { successRate: 0, wealths: [] };
    }

    const months = years * 12;
    const { stocks, bonds, inflation } = marketData;

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
        effectiveAnnualWithdrawal = INVESTED_AMOUNT * withdrawalRate;
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
        let survived = true;

        let currentAnnualWithdrawal = initialAnnualWithdrawal;
        let currentMonthlyWithdrawal = currentAnnualWithdrawal / 12;
        let accumulatedInflation12m = 1.0;

        for (let m = 0; m < months; m++) {
            const idx = s * months + m;

            // 1. Market Factors
            const rLogS = stocks[idx];
            const rLogB = bonds ? bonds[idx] : 0;
            // const rLogC = 0; // TODO: Crypto

            const inflM = inflation[idx];
            if (isNaN(rLogS)) { survived = false; portfolio = 0; break; }

            accumulatedInflation12m *= (1 + inflM);

            // Correct Growth Factor: P_t = P_{t-1} * (1 + R_weighted_linear)
            const rLinS = Math.exp(rLogS) - 1;
            const rLinB = Math.exp(rLogB) - 1;

            // Weighted linear return
            const rLinPort = (wS * rLinS) + (wB * rLinB); // + (wC ... )

            const growthFactor = 1 + rLinPort;

            // 2. Apply Growth
            portfolio *= growthFactor;
            portfolio -= currentMonthlyWithdrawal;

            if (portfolio <= 0) {
                survived = false;
                portfolio = 0;
                break;
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
