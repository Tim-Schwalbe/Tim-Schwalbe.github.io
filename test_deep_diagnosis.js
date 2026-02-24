/**
 * Deep Diagnostic Test for the Crypto SWR Simulator
 * Tests:
 *  1. CAGR verification accuracy (sum-of-logs formula vs per-path)
 *  2. Cycle phase drift sanity check (3 phases)
 *  3. Bear vs No-Bear SWR comparison
 *  4. Safety margin impact on displayed SWR
 *  5. Standalone GBM (no cycles) CAGR check
 */
const fs = require('fs');

global.window = {};
global.Config = {
    getConfig: (configs, key, defaultValue) => {
        if (configs && configs[key] !== undefined) return configs[key];
        return defaultValue;
    }
};

const statsContent = fs.readFileSync('js/engine/stats.js', 'utf8');
eval(statsContent);
global.Stats = window.Stats;

const marketContent = fs.readFileSync('js/engine/market.js', 'utf8');
eval(marketContent);

const simulatorContent = fs.readFileSync('js/engine/simulator.js', 'utf8');
eval(simulatorContent);

const swrContent = fs.readFileSync('js/engine/swr.js', 'utf8');
eval(swrContent);

// Utility: compute per-path CAGR correctly
function computePerPathCAGR(cryptoArray, numSims, months) {
    let totalCAGR = 0;
    let validPaths = 0;
    for (let s = 0; s < numSims; s++) {
        let pathLogSum = 0;
        for (let m = 0; m < months; m++) {
            pathLogSum += cryptoArray[s * months + m];
        }
        const pathAnnualizedLog = pathLogSum / (months / 12); // total log / years
        const pathCAGR = Math.exp(pathAnnualizedLog) - 1;
        if (isFinite(pathCAGR)) { totalCAGR += pathCAGR; validPaths++; }
    }
    return validPaths > 0 ? totalCAGR / validPaths : NaN;
}

// Utility: compute MEDIAN per-path CAGR
function computeMedianCAGR(cryptoArray, numSims, months) {
    const cagrs = [];
    for (let s = 0; s < numSims; s++) {
        let pathLogSum = 0;
        for (let m = 0; m < months; m++) {
            pathLogSum += cryptoArray[s * months + m];
        }
        const pathCAGR = Math.exp(pathLogSum / (months / 12)) - 1;
        if (isFinite(pathCAGR)) cagrs.push(pathCAGR);
    }
    cagrs.sort((a, b) => a - b);
    return cagrs[Math.floor(cagrs.length / 2)];
}

// Per-phase average return (first 120 months = cycle region)
function computePhaseMetrics(cryptoArray, numSims, months, startM, endM) {
    let sumLog = 0;
    let count = 0;
    for (let s = 0; s < numSims; s++) {
        for (let m = startM; m < Math.min(endM, months); m++) {
            sumLog += cryptoArray[s * months + m];
            count++;
        }
    }
    const avgMonthlyLog = sumLog / count;
    return {
        avgMonthlyLog,
        impliedAnnualCAGR: Math.exp(avgMonthlyLog * 12) - 1,
        impliedCAGRpct: ((Math.exp(avgMonthlyLog * 12) - 1) * 100).toFixed(1)
    };
}

(async () => {
    const numSims = 500;
    const years = 30;
    const months = years * 12;

    console.log('='.repeat(70));
    console.log('DIAGNOSTIC 1: GBM Only (No Cycles) - Should match CAGR exactly');
    console.log('='.repeat(70));
    {
        const cfg = {
            RANDOM_SEED: 99999,
            numSims,
            years,
            ALLOC_CRYPTO: 1.0, ALLOC_STOCKS: 0.0,
            C_CAGR_START: 0.30, C_CAGR_MID: 0.30, C_CAGR_END: 0.30,
            C_VOL_START: 0.70, C_VOL_MID: 0.70, C_VOL_END: 0.70,
            USE_FAT_TAILS: false, // NO CYCLES
            INFL_MEAN: 0.025, INFL_VOL: 0.015,
            S_CAGR_START: 0.08, S_CAGR_END: 0.08, S_VOL_START: 0.17, S_VOL_END: 0.17,
            B_CAGR_START: 0.045, B_VOL_START: 0.06,
            SILENT: true
        };
        const md = await window.generateMarketData(numSims, years, cfg);

        // Old "bug" formula from test_100_crypto_reality.js
        let sumLog = 0;
        for (let i = 0; i < md.crypto.length; i++) sumLog += md.crypto[i];
        const buggyCagr = (Math.exp(sumLog / md.crypto.length * 12) - 1) * 100;

        const medianCagr = computeMedianCAGR(md.crypto, numSims, months);
        const meanCagr = computePerPathCAGR(md.crypto, numSims, months);

        console.log(`  Input CAGR:          30.0%`);
        console.log(`  "Flat sum" formula:  ${buggyCagr.toFixed(1)}%  (this is used in test_100_crypto_reality.js)`);
        console.log(`  Correct mean CAGR:   ${(meanCagr * 100).toFixed(1)}%`);
        console.log(`  Correct median CAGR: ${(medianCagr * 100).toFixed(1)}%`);
        console.log(`  NOTE: The "flat sum" formula IS correct (same as mean-log). Median will be lower due`);
        console.log(`        to Jensen's inequality: median path CAGR < mean because of log-normal skew.`);
        console.log(`        The "flat sum" formula measures MEAN LOG DRIFT which equals the target CAGR.`);
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('DIAGNOSTIC 2: Cycles ON - Phase-by-phase drift dissection');
    console.log('='.repeat(70));
    {
        const cfg = {
            RANDOM_SEED: 11111,
            numSims,
            years,
            ALLOC_CRYPTO: 1.0, ALLOC_STOCKS: 0.0,
            C_CAGR_START: 0.32, C_CAGR_MID: 0.12, C_CAGR_END: 0.06,
            C_VOL_START: 0.70, C_VOL_MID: 0.40, C_VOL_END: 0.20,
            USE_FAT_TAILS: true,
            LIMIT_FAT_TAILS_10Y: true,
            START_IN_BEAR_MARKET: false,
            BEAR_MARKET_DEPTH: -0.75,
            INFL_MEAN: 0.025, INFL_VOL: 0.015,
            S_CAGR_START: 0.08, S_CAGR_END: 0.08, S_VOL_START: 0.17, S_VOL_END: 0.17,
            B_CAGR_START: 0.045, B_VOL_START: 0.06,
            SILENT: true
        };
        const md = await window.generateMarketData(numSims, years, cfg);

        // Phase breakdown: Bull (0-17), Bear (18-29), Recovery (30-47) per 48-month cycle
        const fullCyclePhase = computePhaseMetrics(md.crypto, numSims, months, 0, 48);
        const bull1 = computePhaseMetrics(md.crypto, numSims, months, 0, 18);
        const bear1 = computePhaseMetrics(md.crypto, numSims, months, 18, 30);
        const recov1 = computePhaseMetrics(md.crypto, numSims, months, 30, 48);
        const gbmPhase = computePhaseMetrics(md.crypto, numSims, months, 144, months);

        // Theoretical check
        const cagr32 = 0.32;
        const cycleMultiplier = Math.pow(1 + cagr32, 4);
        const peakMult = Math.max(cycleMultiplier * 2.0, 4.0);
        const troughMult = peakMult * (1 + (-0.75));
        const theorBullLog = Math.log(peakMult) / 18 * 12;   // annualized
        const theorBearLog = Math.log(0.25) / 12 * 12;       // annualized
        const theorRecovLog = Math.log(cycleMultiplier / troughMult) / 18 * 12;
        const theorFullCAGR = Math.exp((Math.log(peakMult) - Math.log(1 / troughMult) + Math.log(cycleMultiplier / troughMult)) / 4) - 1;

        console.log(`  NO BEAR START (starts in Bull phase):`);
        console.log(`  ┌─ First 48-month cycle (should match 32% CAGR target):`);
        console.log(`  │  Bull  [0-17]:   actual ${bull1.impliedCAGRpct}%/yr  | theory ${(Math.exp(theorBullLog) - 1) * 100 | 0}%/yr`);
        console.log(`  │  Bear  [18-29]:  actual ${bear1.impliedCAGRpct}%/yr  | theory ${(Math.exp(theorBearLog) - 1) * 100 | 0}%/yr`);
        console.log(`  │  Recov [30-47]:  actual ${recov1.impliedCAGRpct}%/yr  | theory ${(Math.exp(theorRecovLog) - 1) * 100 | 0}%/yr`);
        console.log(`  │  Full cycle avg: actual ${(fullCyclePhase.impliedAnnualCAGR * 100).toFixed(1)}%  | theory ~32%`);
        console.log(`  └─ Expected cycle CAGR: (1.32)^4 over 4 years = ${(cycleMultiplier).toFixed(2)}x → 32%`);
        console.log(`  ┌─ GBM Phase [yr 12-30]:`);
        console.log(`  │  Observed: ${gbmPhase.impliedCAGRpct}%/yr  (should taper 12% → 6%, avg ~9%)`);
        console.log(`  └─`);
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('DIAGNOSTIC 3: BEAR START vs NO BEAR START - Full comparison');
    console.log('='.repeat(70));
    {
        const baseConfig = {
            RANDOM_SEED: 42424,
            numSims: 1000,
            years: 30,
            INVESTED_AMOUNT: 1000000,
            CASH_BUFFER: 0,
            ALLOC_CRYPTO: 1.0, ALLOC_STOCKS: 0.0,
            C_CAGR_START: 0.4518, C_CAGR_MID: 0.10, C_CAGR_END: 0.06,
            C_VOL_START: 0.70, C_VOL_MID: 0.40, C_VOL_END: 0.20,
            USE_FAT_TAILS: true,
            LIMIT_FAT_TAILS_10Y: true,
            BEAR_MARKET_DEPTH: -0.75,
            S_CAGR_START: 0.08, S_CAGR_END: 0.08, S_VOL_START: 0.17, S_VOL_END: 0.17,
            B_CAGR_START: 0.045, B_VOL_START: 0.06,
            INFL_MEAN: 0.025, INFL_VOL: 0.015,
            TARGET_SUCCESS_PERCENT: 90,
            SILENT: true
        };

        for (const bearStart of [false, true]) {
            const cfg = { ...baseConfig, START_IN_BEAR_MARKET: bearStart };

            // Determine cyclesCutoffMonth (mirrors market.js)
            const cycleOffset = bearStart ? 18 : 0;
            let cutoff = months;
            for (let m = 120; m < 120 + 48; m++) {
                if ((m + cycleOffset) % 48 === 0) { cutoff = m; break; }
            }

            const md = await window.generateMarketData(cfg.numSims, years, cfg);

            // Phase metrics
            const cycleRegion = computePhaseMetrics(md.crypto, cfg.numSims, months, 0, cutoff);
            const gbmRegion = computePhaseMetrics(md.crypto, cfg.numSims, months, cutoff, months);

            // Find SWR at 90%  (WITHOUT safety margin – using raw requiredSuccess = 0.90)
            // We override the internal findSWR by manually bisecting:
            let lo = 0.001, hi = 0.30, bestRaw = 0.001;
            for (let i = 0; i < 30; i++) {
                const mid = (lo + hi) / 2;
                const res = window.simulatePortfolio(mid, md, { ...cfg, SILENT: true });
                if (res.successRate >= 0.90) { bestRaw = mid; lo = mid; }
                else { hi = mid; }
                if (hi - lo < 0.00005) break;
            }

            // Also: SWR at 95% (raw)
            let lo2 = 0.001, hi2 = 0.30, bestRaw95 = 0.001;
            for (let i = 0; i < 30; i++) {
                const mid = (lo2 + hi2) / 2;
                const res = window.simulatePortfolio(mid, md, { ...cfg, SILENT: true });
                if (res.successRate >= 0.95) { bestRaw95 = mid; lo2 = mid; }
                else { hi2 = mid; }
                if (hi2 - lo2 < 0.00005) break;
            }

            // findSWR (with safety margin: 0.5% + 100%*3.5% = 4% adder → targets 94%)
            const swrDisplayed = await window.findSWR(0.90, md, cfg);

            // Verify success at key rates
            const at1pct = window.simulatePortfolio(0.01, md, { ...cfg, SILENT: true }).successRate;
            const at1p5pct = window.simulatePortfolio(0.015, md, { ...cfg, SILENT: true }).successRate;
            const at2pct = window.simulatePortfolio(0.02, md, { ...cfg, SILENT: true }).successRate;
            const at3pct = window.simulatePortfolio(0.03, md, { ...cfg, SILENT: true }).successRate;

            // Median CAGR check
            let sumL = 0;
            for (let i = 0; i < md.crypto.length; i++) sumL += md.crypto[i];
            const flatCagr = (Math.exp(sumL / md.crypto.length * 12) - 1) * 100;

            console.log(`\n  ══ ${bearStart ? 'BEAR START' : 'NO BEAR START'} ══`);
            console.log(`  Cycle cutoff month: ${cutoff} (${(cutoff / 12).toFixed(1)} yrs)`);
            console.log(`  Cycle region [0-${cutoff}m] avg CAGR: ${cycleRegion.impliedCAGRpct}%/yr`);
            console.log(`  GBM region [${cutoff}-${months}m] avg CAGR: ${gbmRegion.impliedCAGRpct}%/yr`);
            console.log(`  Overall flat-sum CAGR: ${flatCagr.toFixed(1)}%  (test_100_crypto_reality formula)`);
            console.log(`  ─ SWR Results ─`);
            console.log(`  SWR displayed (findSWR @90%, +4% margin internally = 94%): ${(swrDisplayed * 100).toFixed(2)}%`);
            console.log(`  SWR raw @90% success:  ${(bestRaw * 100).toFixed(2)}%`);
            console.log(`  SWR raw @95% success:  ${(bestRaw95 * 100).toFixed(2)}%`);
            console.log(`  ─ Success rates at fixed withdrawal rates ─`);
            console.log(`  1.0% success:  ${(at1pct * 100).toFixed(1)}%`);
            console.log(`  1.5% success:  ${(at1p5pct * 100).toFixed(1)}%`);
            console.log(`  2.0% success:  ${(at2pct * 100).toFixed(1)}%`);
            console.log(`  3.0% success:  ${(at3pct * 100).toFixed(1)}%`);
            console.log(`  ─ What findSWR returns vs what user expects ─`);
            console.log(`  User targets 90% success. findSWR targets 94% (90+4% safety margin).`);
            console.log(`  → Displayed SWR (${(swrDisplayed * 100).toFixed(2)}%) achieves ~94%, NOT 90%.`);
            console.log(`  → The actual 90%-success SWR is ${(bestRaw * 100).toFixed(2)}%.`);
        }
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('DIAGNOSTIC 4: Safety Margin Math Validation');
    console.log('='.repeat(70));
    {
        console.log('  In swr.js, for 100% crypto (allocC=1.0):');
        const allocC = 1.0;
        const baseMargin = 0.005;
        const cryptoMarginAdder = allocC * 0.035;
        const safetyMargin = baseMargin + cryptoMarginAdder;
        console.log(`  baseMargin:         ${(baseMargin * 100).toFixed(1)}%`);
        console.log(`  cryptoMarginAdder:  ${(cryptoMarginAdder * 100).toFixed(1)}%  (allocC * 3.5%)`);
        console.log(`  Total safetyMargin: ${(safetyMargin * 100).toFixed(1)}%`);
        console.log(`  requiredSuccess:    90% + ${(safetyMargin * 100).toFixed(1)}% = ${((0.90 + safetyMargin) * 100).toFixed(1)}%`);
        console.log(`  This means:: findSWR returns the rate for 94% success when user wants 90%.`);
        console.log(`  → The display SWR will be LOWER than the actual 90%-success SWR.`);
        console.log(`  → This is conservative/safe for users but may show unrealistically low SWR.`);
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('DIAGNOSTIC 5: Cycle Math Verification');
    console.log('='.repeat(70));
    {
        const cagrInputs = [0.20, 0.32, 0.4518];
        for (const cagr of cagrInputs) {
            const cycleMultiplier = Math.pow(1 + cagr, 4);
            const peakMult = Math.max(cycleMultiplier * 2.0, 4.0);
            const bearDepth = -0.75;
            const troughMult = peakMult * (1 + bearDepth);

            const bullLogGain = Math.log(peakMult);
            const bearLogGain = Math.log(1 + bearDepth);           // = ln(0.25)
            const recovLogGain = Math.log(cycleMultiplier / troughMult);
            const totalLogGain = bullLogGain + bearLogGain + recovLogGain;
            const impliedCAGR = Math.exp(totalLogGain / 4) - 1;

            console.log(`  Input CAGR ${(cagr * 100).toFixed(2)}%:`);
            console.log(`    cycleMultiplier = ${cycleMultiplier.toFixed(3)}x  peakMult = ${peakMult.toFixed(3)}x  troughMult = ${troughMult.toFixed(3)}x`);
            console.log(`    Bull log gain:    +${bullLogGain.toFixed(3)}`);
            console.log(`    Bear log gain:    ${bearLogGain.toFixed(3)}`);
            console.log(`    Recov log gain:   +${recovLogGain.toFixed(3)}`);
            console.log(`    Total 4yr log:    ${totalLogGain.toFixed(3)} → implies CAGR ${(impliedCAGR * 100).toFixed(2)}%`);
            console.log(`    Match: ${Math.abs(impliedCAGR - cagr) < 0.001 ? '✅ CORRECT' : '❌ MISMATCH'}`);
            if (Math.abs(troughMult - cycleMultiplier) < 0.001) {
                console.log(`    ⚠️  troughMult ≈ cycleMultiplier → recovery gain ≈ 0 (flat recovery!)`);
            }
        }
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('DIAGNOSTIC 6: T-distribution bias test (stdBoost formula)');
    console.log('='.repeat(70));
    {
        const N = 100000;
        const df = 5;
        const rho = 0.80;
        const sqrtRho = Math.sqrt(rho);
        const sqrtOneMinusRho = Math.sqrt(1 - rho);
        const stdBoost = Math.sqrt((5 - 2 * rho) / 3);

        let sumZ = 0, sumZ2 = 0;
        Stats.seed(55555);
        for (let i = 0; i < N; i++) {
            let te = Stats.randomT(df);
            te = Math.max(-4, Math.min(4, te));
            const zC = Stats.randomNormal(0, 1);
            const finalZ = sqrtRho * zC + sqrtOneMinusRho * te;
            const scaledZ = finalZ / stdBoost; // after the division in market.js
            sumZ += scaledZ;
            sumZ2 += scaledZ * scaledZ;
        }
        const meanZ = sumZ / N;
        const varZ = sumZ2 / N - meanZ * meanZ;
        console.log(`  After stdBoost correction (N=${N}):`);
        console.log(`  Mean of finalZ/stdBoost: ${meanZ.toFixed(5)}  (should be ~0)`);
        console.log(`  Var  of finalZ/stdBoost: ${varZ.toFixed(4)}  (should be ~1.0)`);
        console.log(`  stdBoost formula: sqrt((5 - 2*${rho})/3) = ${stdBoost.toFixed(4)}`);
        console.log(`  ${Math.abs(varZ - 1) < 0.05 ? '✅ Variance normalized correctly' : '❌ Variance NOT normalized!'}`);
    }

    console.log('\nAll diagnostics complete.');
})();
