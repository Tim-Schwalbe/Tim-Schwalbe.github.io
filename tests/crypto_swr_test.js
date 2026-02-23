const fs = require('fs');
const vm = require('vm');

// Create a browser-like environment
const sandbox = {
    window: {},
    console: console,
    Math: Math
};
sandbox.window.Config = { getConfig: (configs, key, def) => configs[key] !== undefined ? configs[key] : def };
sandbox.Config = sandbox.window.Config;
vm.createContext(sandbox);

// Load the scripts into the sandbox
const marketScript = fs.readFileSync('./js/engine/market.js', 'utf8');
const simulatorScript = fs.readFileSync('./js/engine/simulator.js', 'utf8');

// Modify the simulator script slightly to expose runSimulation instead of using ES6 exports (which VM doesn't like directly with CommonJS requires usually, but market.js exports)
// Actually, market.js uses CommonJS module.exports at the bottom. We need to handle that or strip it.
const cleanMarketScript = marketScript.replace(/module\.exports\s*=\s*{[^}]+};/g, 'window.generateMarketData = generateMarketData; window.generateV5CryptoMarketData = generateV5CryptoMarketData;');
const cleanSimulatorScript = simulatorScript.replace(/module\.exports\s*=\s*{[^}]+};/g, '');

vm.runInContext(cleanMarketScript, sandbox);
vm.runInContext(cleanSimulatorScript, sandbox);

function runTest() {
    console.log("=== 100% Crypto SWR Verification ===");
    
    // Test configs matching the UI defaults
    const configs = {
        S_CAGR_START: 0.07, S_CAGR_END: 0.07, S_VOL_START: 0.15, S_VOL_END: 0.15,
        B_CAGR_START: 0.03, B_VOL_START: 0.05,
        C_CAGR_START: 0.35, C_CAGR_END: 0.10, C_VOL_START: 0.75, C_VOL_END: 0.40,
        INFL_MEAN: 0.025, INFL_VOL: 0.015,
        CORR_START: 0.20, CORR_END: 0.40,
        
        // 4-Year Cycle Settings
        USE_FAT_TAILS: true,
        LIMIT_FAT_TAILS_10Y: true,
        START_IN_BEAR_MARKET: true,
        BEAR_MARKET_DEPTH: 0.25, // -75%
        
        YEARS: 30,
        START_CAP: 1000000,
        ANNUAL_CONTRIB: 0,
        S_ALLOC: 0, B_ALLOC: 0, C_ALLOC: 100, // 100% Crypto
        
        REBAL_FREQ: 1, // Annual
        FEE_PCT: 0,
        SILENT: true // Suppress normal engine logs
    };

    console.log("Config: 100% Crypto, Starting in -75% Bear Market");
    
    // We want to find the exact SWR that gives a 90% success rate
    let lowSpend = 0;       // 0% SWR
    let highSpend = 100000; // 10% SWR
    let currentSWR = 0;
    
    // Binary search for SWR
    for(let i=0; i<15; i++) {
        const testSpend = (lowSpend + highSpend) / 2;
        configs.ANNUAL_SPEND = testSpend;
        
        let successes = 0;
        const NUM_SIMS = 1000;
        
        for(let s=0; s<NUM_SIMS; s++) {
            const marketData = sandbox.window.generateMarketData(configs, s);
            const simResult = sandbox.window.simulatePortfolio(testSpend / configs.START_CAP, marketData, configs);
            if (simResult.successRate > 0) successes++;
        }
        
        const winRate = successes / NUM_SIMS;
        if (winRate >= 0.90) {
            lowSpend = testSpend; // We can spend more
        } else {
            highSpend = testSpend; // We must spend less
        }
    }
    
    currentSWR = (lowSpend / configs.START_CAP) * 100;
    console.log(`Calculated 90% Success SWR: ${currentSWR.toFixed(2)}% ($${lowSpend.toFixed(0)}/yr)`);
    
    // Math Check (Simulation 0)
    console.log("\n--- Math Check (Simulation 0) ---");
    configs.ANNUAL_SPEND = lowSpend; // ~$8k
    const marketData = sandbox.window.generateMarketData(configs, 0);
    const simResult = sandbox.window.simulatePortfolio(lowSpend / configs.START_CAP, marketData, configs);
    
    console.log(`Initial Capital: $1,000,000`);
    console.log(`Annual Withdrawal: $${lowSpend.toFixed(0)}`);
    
    // Calculate cumulative 1-year return from log returns
    let y1ReturnLog = 0;
    for(let i=0; i<12; i++) y1ReturnLog += marketData.crypto[i];
    console.log(`Year 1 Crypto Return: ${((Math.exp(y1ReturnLog) - 1)*100).toFixed(1)}%`);
    
    // To get End Year 1 Balance, we need to hack into the monthly steps or just look at wealths if it failed early (but we know it's a 90% pass rate so it probably didn't fail Y1)
    // Actually, simulatePortfolio returns an array of final wealths, not yearly data. 
    // Let's run a custom 12-month loop to show the math clearly.
    
    let portfolio = 1000000;
    for(let i=0; i<12; i++) {
        const growth = 1 + (Math.exp(marketData.crypto[i]) - 1);
        portfolio = portfolio * growth;
        portfolio -= (lowSpend / 12);
    }
    console.log(`Portfolio Balance End Year 1 (Manual Calc): $${portfolio.toFixed(0)}`);
    
    let y2ReturnLog = 0;
    for(let i=12; i<24; i++) y2ReturnLog += marketData.crypto[i];
    console.log(`Year 2 Crypto Return: ${((Math.exp(y2ReturnLog) - 1)*100).toFixed(1)}%`);
    
    for(let i=12; i<24; i++) {
        const growth = 1 + (Math.exp(marketData.crypto[i]) - 1);
        portfolio = portfolio * growth;
        portfolio -= (lowSpend / 12);
    }
    console.log(`Portfolio Balance End Year 2 (Manual Calc): $${portfolio.toFixed(0)}`);
    
    let y3ReturnLog = 0;
    for(let i=24; i<36; i++) y3ReturnLog += marketData.crypto[i];
    console.log(`Year 3 Crypto Return: ${((Math.exp(y3ReturnLog) - 1)*100).toFixed(1)}%`);
    
    let y4ReturnLog = 0;
    for(let i=36; i<48; i++) y4ReturnLog += marketData.crypto[i];
    console.log(`Year 4 Crypto Return: ${((Math.exp(y4ReturnLog) - 1)*100).toFixed(1)}%`);
    
}

runTest();
