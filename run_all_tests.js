const fs = require('fs');
const path = require('path');
const vm = require('vm');

// --- Configuration ---
const ENGINE_FILES = [
    'js/engine/stats.js',
    'js/engine/market.js',
    'js/engine/swr.js',
    'js/engine/simulator.js'
];

const TEST_FILES = [
    'js/tests/simulator_tests.js',
    'test_market_refinement.js',
    'test_crash_logic.js',
    'tests/unit_test_calc_step.js',
    'tests/simulation_tests.js'
];

// --- Mock Browser Environment ---
const sandbox = {
    window: {},
    console: console,
    Math: Math,
    parseFloat: parseFloat,
    parseInt: parseInt,
    Float64Array: Float64Array,
    process: { exit: (code) => { throw new Error(`Process.exit(${code}) called`); } }, // Trap exits
    require: require,
    __dirname: __dirname,
    Config: {
        getConfig: (configs, key, defaultValue) => {
            if (configs && configs[key] !== undefined) return configs[key];
            return defaultValue;
        }
    }
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);

// --- Helper to Load Script ---
function loadScript(filePath) {
    const fullPath = path.resolve(__dirname, filePath);
    const code = fs.readFileSync(fullPath, 'utf8');
    vm.runInContext(code, sandbox);
}

// --- Main Runner ---
async function runAllTests() {
    console.log("🚀 Starting Unified Test Suite...");
    let passedTests = 0;
    let failedTests = 0;

    // 1. Load Engine
    console.log("\n📦 Loading Engine...");
    ENGINE_FILES.forEach(file => {
        try {
            loadScript(file);
            console.log(`  - Loaded ${file}`);
        } catch (e) {
            console.error(`  ❌ Failed to load ${file}:`, e.message);
            process.exit(1);
        }
    });

    // 2. Run Tests
    console.log("\n🧪 Executing Test Suites...");

    for (const testFile of TEST_FILES) {
        console.log(`\n--- Running ${testFile} ---`);
        try {
            if (testFile.endsWith('unit_test_calc_step.js')) {
                // specific handling for unit_test_calc_step which uses its own vm
                // actually, better to just require it if it's standalone, or load code into OUR sandbox if compatible.
                // The file 'tests/unit_test_calc_step.js' uses `require` and internal `vm`. 
                // Let's execute it as a child process to avoid context pollution or conflicts, OR refactor it.
                // Given "run manually it work", child process is safest for now to preserve its env.
                await runIsolate(testFile);
            } else if (testFile === 'js/tests/simulator_tests.js') {
                loadScript(testFile);
                if (sandbox.window.runTests) {
                    const result = sandbox.window.runTests();
                    if (result) {
                        console.log(`  ✅ ${testFile} Passed`);
                        passedTests++;
                    } else {
                        throw new Error("runTests returned false");
                    }
                } else {
                    console.log(`  ⚠️ ${testFile} loaded but no runTests() found.`);
                }
            } else {
                // For test_market_refinement.js and test_crash_logic.js
                // They likely contain top-level code that runs on load.
                // We need to capture their console output to determine pass/fail or wrap them.
                // Since they are designed to run with `node filename`, let's run them as child processes too.
                await runIsolate(testFile);
            }
            passedTests++; // If runIsolate doesn't throw, it passed.
        } catch (e) {
            console.error(`  ❌ ${testFile} FAILED:`, e.message);
            failedTests++;
        }
    }

    console.log(`\n🏁 Test Summary: ${passedTests} Passed, ${failedTests} Failed.`);
    if (failedTests > 0) process.exit(1);
}

// Helper to run a test file in a separate process (to handle those designed as standalone scripts)
const { exec } = require('child_process');
function runIsolate(filePath) {
    return new Promise((resolve, reject) => {
        exec(`node ${filePath}`, (error, stdout, stderr) => {
            if (stdout) console.log(stdout.trim());
            if (stderr) console.error(stderr.trim());
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

runAllTests();
