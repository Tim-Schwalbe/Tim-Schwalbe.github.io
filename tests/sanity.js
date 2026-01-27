const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadScript(filePath, sandbox) {
    const code = fs.readFileSync(filePath, 'utf8');
    vm.runInContext(code, sandbox); // Execute in the shared context
}

// 1. Setup Browser Sandbox
const sandbox = {
    window: {},
    document: {
        getElementById: () => ({ addEventListener: () => { } }),
        addEventListener: () => { },
        querySelector: () => { }
    },
    console: console,
    Math: Math,
    parseFloat: parseFloat,
    parseInt: parseInt,
    setTimeout: (fn) => fn(),
    requestAnimationFrame: (fn) => fn(),
    Float64Array: Float64Array
};
sandbox.window = sandbox; // Self-reference for window
vm.createContext(sandbox);

// 2. Load Scripts in Dependency Order
const jsDir = path.join(__dirname, '../js');
loadScript(path.join(jsDir, 'utils/config.js'), sandbox);
loadScript(path.join(jsDir, 'engine/stats.js'), sandbox);
loadScript(path.join(jsDir, 'engine/market.js'), sandbox);
loadScript(path.join(jsDir, 'engine/simulator.js'), sandbox);

// 3. Verify
console.log("SANITY CHECK:");
console.log("Stats loaded:", !!sandbox.window.Stats);
console.log("Config loaded:", !!sandbox.window.Config);
console.log("Market Generator loaded:", !!sandbox.window.generateMarketData);
console.log("Simulator loaded:", !!sandbox.window.simulatePortfolio);

if (sandbox.window.Stats && sandbox.window.simulatePortfolio) {
    console.log("✅ Modules Loaded Successfully");
    process.exit(0);
} else {
    console.error("❌ Modules Failed to Load");
    process.exit(1);
}
