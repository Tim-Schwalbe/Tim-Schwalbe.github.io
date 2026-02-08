const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

// 1. Setup Sandbox
const sandbox = {
    window: {},
    console: console,
    Math: Math,
    parseFloat: parseFloat,
    parseInt: parseInt,
    Float64Array: Float64Array
};
sandbox.window = sandbox;
vm.createContext(sandbox);

// 2. Load Simulator
const jsDir = path.join(__dirname, '../js');
const simCode = fs.readFileSync(path.join(jsDir, 'engine/simulator.js'), 'utf8');
vm.runInContext(simCode, sandbox);

const calculateMonthlyStep = sandbox.window.calculateMonthlyStep;

console.log("🧪 Running Unit Tests for calculateMonthlyStep...");

// TEST 1: Simple Growth (No Withdrawals, No Inflation)
// Portfolio: 1000, 10% return (simple) -> 1100
// Log return for 10% simple is ln(1.1) = 0.09531
try {
    const inputs = {
        stockReturn: Math.log(1.1),
        bondReturn: 0,
        cryptoReturn: 0,
        inflation: 0
    };
    const state = {
        portfolio: 1000,
        cash: 0,
        accumulatedInflation: 1.0,
        currentBaseNeed: 0,
        currentMonthlyWithdrawal: 0,
        monthIdx: 0
    };
    const config = {
        wS: 1.0, wB: 0, wC: 0,
        INVESTED_AMOUNT: 1000,
        REFILL_CASH_BUFFER: false
    };

    const res = calculateMonthlyStep(state, inputs, config);
    const expected = 1100;
    // Tolerate floating point errors
    assert(Math.abs(res.portfolio - expected) < 0.01, `Test 1 Failed: Expected ${expected}, got ${res.portfolio}`);
    console.log("✅ Test 1: Simple Growth Passed");

} catch (e) {
    console.error("❌ Test 1 Failed:", e.message);
    process.exit(1);
}

// TEST 2: Withdrawal Logic
// Portfolio 1000, 0% return. Withdraw 10.
try {
    const inputs = {
        stockReturn: 0,
        bondReturn: 0,
        cryptoReturn: 0,
        inflation: 0
    };
    const state = {
        portfolio: 1000,
        cash: 0,
        accumulatedInflation: 1.0,
        currentBaseNeed: 0,
        currentMonthlyWithdrawal: 10,
        monthIdx: 0
    };
    const config = {
        wS: 1.0, wB: 0, wC: 0,
        INVESTED_AMOUNT: 1000
    };

    const res = calculateMonthlyStep(state, inputs, config);
    const expected = 990;
    assert(Math.abs(res.portfolio - expected) < 0.01, `Test 2 Failed: Expected ${expected}, got ${res.portfolio}`);
    console.log("✅ Test 2: Withdrawal Passed");

} catch (e) {
    console.error("❌ Test 2 Failed:", e.message);
    process.exit(1);
}

// TEST 3: Inflation Accumulation
try {
    const inputs = {
        stockReturn: 0,
        bondReturn: 0,
        cryptoReturn: 0,
        inflation: 0.02 // 2% monthly inflation
    };
    const state = {
        portfolio: 1000,
        cash: 0,
        accumulatedInflation: 1.0,
        currentBaseNeed: 0,
        currentMonthlyWithdrawal: 0,
        monthIdx: 0
    };
    const config = { wS: 1, wB: 0, wC: 0 };

    const res = calculateMonthlyStep(state, inputs, config);
    // newInflation = 1.0 * 1.02 = 1.02
    // If monthIdx is 0 (first month), it returns accumulatedInflation as 1.02 unless it wraps year (mod 12)
    // Code: ((monthIdx + 1) % 12 === 0) ? 1.0 : newInflation
    // 0 + 1 = 1 % 12 != 0. So returns 1.02.
    assert(Math.abs(res.accumulatedInflation - 1.02) < 0.0001, `Test 3 Failed: Inflation acc logic`);
    console.log("✅ Test 3: Inflation Accumulation Passed");

} catch (e) {
    console.error("❌ Test 3 Failed:", e.message);
    process.exit(1);
}

console.log("🎉 All Tests Passed!");
