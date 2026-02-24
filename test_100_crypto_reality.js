/**
 * Reality Check for 100% Crypto Portfolio
 * Runs BOTH bear-start and no-bear-start scenarios side-by-side.
 * Config matches UI defaults (C_CAGR_START: 0.4518, target: 90%).
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

(async () => {
    const NUM_SIMS = 1000;
    const YEARS = 30;

    // UI-default config for 100% crypto (matches main.js defaults)
    const baseConfig = {
        RANDOM_SEED: 12345,
        numSims: NUM_SIMS,
        years: YEARS,
        INVESTED_AMOUNT: 1_000_000,
        CASH_BUFFER: 0,

        ALLOC_CRYPTO: 1.0,
        ALLOC_STOCKS: 0.0,

        // UI defaults: 45.18% initial CAGR (target $1M from $24,038 BTC bear low in 10yr)
        C_CAGR_START: 0.4518,
        C_CAGR_MID: 0.10,   // maturation at year 10
        C_CAGR_END: 0.06,   // terminal CAGR

        C_VOL_START: 0.70,
        C_VOL_MID: 0.40,
        C_VOL_END: 0.20,

        USE_FAT_TAILS: true,
        LIMIT_FAT_TAILS_10Y: true,
        BEAR_MARKET_DEPTH: -0.75,

        S_CAGR_START: 0.08, S_CAGR_END: 0.08,
        S_VOL_START: 0.17, S_VOL_END: 0.17,
        B_CAGR_START: 0.045, B_VOL_START: 0.06,

        INFL_MEAN: 0.025,
        INFL_VOL: 0.015,

        SILENT: true
    };

    const scenarios = [
        { name: 'NO BEAR START  (retire at bull market peak)', bearStart: false },
        { name: 'WITH BEAR START (retire into bear market)', bearStart: true },
    ];

    console.log('100% Crypto Portfolio – SWR Reality Check');
    console.log('Config: C_CAGR_START=45.18%, VOL=70%, 30yr, 1000 sims, $1M');
    console.log('='.repeat(65));

    for (const scenario of scenarios) {
        const cfg = { ...baseConfig, START_IN_BEAR_MARKET: scenario.bearStart };
        console.log(`\n▶ Scenario: ${scenario.name}`);

        console.log('  Generating 1,000 market paths...');
        const md = await window.generateMarketData(NUM_SIMS, YEARS, cfg);

        // Mean log CAGR check over all paths
        let sumLog = 0;
        for (let i = 0; i < md.crypto.length; i++) sumLog += md.crypto[i];
        const avgCAGR = (Math.exp(sumLog / md.crypto.length * 12) - 1) * 100;
        console.log(`  Mean-log annualized CAGR in generated data: ${avgCAGR.toFixed(1)}%`);

        // SWR at 90% target (exact, no hidden margin)
        console.log('  Finding SWR at 90% target...');
        const swr90 = await window.findSWR(0.90, md, cfg);
        console.log(`  → SWR @90% success:  ${(swr90 * 100).toFixed(2)}%`);

        // SWR at 95% target
        const swr95 = await window.findSWR(0.95, md, cfg);
        console.log(`  → SWR @95% success:  ${(swr95 * 100).toFixed(2)}%`);

        // Success rates at key fixed withdrawal rates
        const rates = [0.01, 0.015, 0.02, 0.03, 0.04, 0.05];
        console.log('  ─ Success rates at fixed withdrawal rates ─');
        for (const r of rates) {
            const res = window.simulatePortfolio(r, md, { ...cfg, SILENT: true });
            console.log(`  ${(r * 100).toFixed(1)}% withdrawal: ${(res.successRate * 100).toFixed(1)}% success`);
        }

        // Run at the 90% SWR to get stats
        const res = window.simulatePortfolio(swr90, md, { ...cfg, SILENT: true });
        const sortedW = [...res.wealths].sort((a, b) => a - b);
        const medW = sortedW[Math.floor(sortedW.length * 0.5)];
        const p5W = sortedW[Math.floor(sortedW.length * 0.05)];
        console.log('  ─ At the 90% SWR ─');
        console.log(`  Annual withdrawal:        $${Math.round(1_000_000 * swr90).toLocaleString()}`);
        console.log(`  Success rate (verify):    ${(res.successRate * 100).toFixed(1)}%`);
        console.log(`  Median final wealth:      $${Math.round(medW).toLocaleString()}`);
        console.log(`  5th percentile wealth:    $${Math.round(p5W).toLocaleString()}`);
        console.log(`  Median real final wealth: $${Math.round(res.stats.medianRealFinalWealth).toLocaleString()}`);
        console.log(`  Median max drawdown:      ${(res.stats.medianMaxDrawdown * 100).toFixed(1)}%`);
    }

    console.log('\n' + '='.repeat(65));
    console.log('Interpretation:');
    console.log('  NO BEAR START: Retire at start of a 4-yr bull cycle (best case).');
    console.log('  BEAR START:    Retire at the START of a -75% crypto crash (worst case).');
    console.log('  The gap between them shows the sequence-of-returns risk.');
    console.log('  UI default (START_IN_BEAR_MARKET=true) is the conservative/safe setting.');
})();
