const fs = require('fs');
const path = require('path');

// Mock Environment
global.window = {};
global.Config = {
    getConfig: (configs, key, defaultValue) => {
        if (configs && configs[key] !== undefined) return configs[key];
        return defaultValue;
    }
};

// Load Scripts
const statsContent = fs.readFileSync(path.join(__dirname, 'js/engine/stats.js'), 'utf8');
eval(statsContent);
global.Stats = window.Stats;

const marketContent = fs.readFileSync(path.join(__dirname, 'js/engine/market.js'), 'utf8');
eval(marketContent);

(async () => {
    console.log("Running Crash Logic Verification...");

    const baseConfig = {
        RANDOM_SEED: 12345,
        FORCE_CRASH: true,
        CRASH_DURATION: 1, // 1 year only

        // Custom Floors
        CRASH_FLOOR_STOCKS: -0.20, // -20% max monthly return
        CRASH_FLOOR_CRYPTO: -0.50, // -50% max monthly return
        CRASH_FLOOR_BONDS: -0.05,  // -5% max monthly return
    };

    // 1 sim, 10 years
    const data = await window.generateMarketData(1, 10, baseConfig);

    // Check Year 1 (Months 0-11)
    let failures = 0;
    for (let i = 0; i < 12; i++) {
        const s = data.stocks[i];
        const c = data.crypto[i];
        const b = data.bonds[i];

        if (s > -0.20 + 1e-9) {
            console.error(`FAIL: Month ${i} Stock Return ${s} > -0.20`);
            failures++;
        }
        // V6 modification: Since crypto returns can now be very negative during fixed crashes
        // we need to ensure they hit the CRASH_FLOOR_CRYPTO
        if (c > -0.50 + 1e-9) {
            console.error(`FAIL: Month ${i} Crypto Return ${c} > -0.50`);
            failures++;
        }
        if (b > -0.05 + 1e-9) {
            console.error(`FAIL: Month ${i} Bond Return ${b} > -0.05`);
            failures++;
        }
    }

    // Check Year 2 (Months 12-23) - Should NOT be capped (unless by random chance)
    // We can't guarantee they are > floor, but they shouldn't be FORCED to be <= floor.
    // Actually, random normal(0,1) * vol can be anything.
    // But we just want to ensure year 1 IS capped.

    if (failures === 0) {
        console.log("PASS: All months in crash duration were strictly below the floor.");
    } else {
        console.log(`FAIL: ${failures} violations found.`);
    }
})();
