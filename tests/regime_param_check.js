
const fs = require('fs');

// User Provided Parameters
const BEAR_MU_RAW = -0.43;
const BULL_MU_RAW = 0.39;

// Transition Probs (Monthly)
const P_BEAR_STAY = 0.00;
const P_BULL_STAY = 0.97;
const P_NORM_TO_BEAR = 0.09;
const P_NORM_TO_BULL = 0.008;

// Derived Matrix
// Bear -> always exit? To where? User didn't specify P_BEAR_TO_NORM or BULL.
// Assuming "Transient" means Bear -> Normal (1.0).
const P_BEAR_TO_NORM = 1.0;
const P_BEAR_TO_BULL = 0.0;

// Bull -> Stay 0.97. Exit 0.03. To where? Usually Normal.
const P_BULL_TO_NORM = 0.03;
const P_BULL_TO_BEAR = 0.00;

// Normal -> Stay?
// Sum of exits = 0.09 (Bear) + 0.008 (Bull) = 0.098.
// So P_NORM_STAY = 1 - 0.098 = 0.902.
const P_NORM_STAY = 1 - P_NORM_TO_BEAR - P_NORM_TO_BULL;

console.log("Transition Matrix (Normal Based):");
console.log(`Normal -> Stay: ${P_NORM_STAY.toFixed(3)}, Bear: ${P_NORM_TO_BEAR}, Bull: ${P_NORM_TO_BULL}`);

function simulate(months, mode) {
    let wealth = 1.0;
    let state = 'NORMAL';
    let history = [];

    for (let i = 0; i < months; i++) {
        // Transition
        let r = Math.random();
        if (state === 'NORMAL') {
            if (r < P_NORM_TO_BEAR) state = 'BEAR';
            else if (r < P_NORM_TO_BEAR + P_NORM_TO_BULL) state = 'BULL';
        } else if (state === 'BEAR') {
            // Transient: Always exit to Normal? Or check P_BEAR_STAY?
            if (r >= P_BEAR_STAY) state = 'NORMAL';
        } else if (state === 'BULL') {
            if (r >= P_BULL_STAY) state = 'NORMAL';
        }

        // Return
        let mu = 0;
        if (state === 'NORMAL') mu = 0.045 / 12; // Base Normal? User said 0.045 mean. Monthly? 
        // User said: "normal regime's fitted mean (0.045)". If monthly, that's huge (54% ann).
        // Let's assume Normal Mu is Monthly 0.045 (54% annualized) as baseline. 
        // Bitcoin avg is ~50-60%.
        if (mode === 'ANNUAL_PARAMS') {
            // Interpret USER PARAMS as Annualized
            if (state === 'BEAR') mu = BEAR_MU_RAW / 12;
            if (state === 'BULL') mu = BULL_MU_RAW / 12;
            if (state === 'NORMAL') mu = 0.54 / 12; // Assuming 0.045 was monthly, so ~0.54 annual.
        } else {
            // Interpret USER PARAMS as Monthly
            if (state === 'BEAR') mu = BEAR_MU_RAW;
            if (state === 'BULL') mu = BULL_MU_RAW;
            if (state === 'NORMAL') mu = 0.045;
        }

        // Simple drift simulation (ignoring sigma for mean check)
        wealth *= Math.exp(mu);
        history.push(wealth);
    }
    return wealth;
}

console.log("\n--- Simulation 10 Years (120 months) ---");
console.log("Mode: MONTHLY interpretation (Mu = " + BULL_MU_RAW + " monthly)");
let w_monthly = simulate(120, 'MONTHLY_PARAMS');
console.log("Final Wealth (Monthly Params): " + w_monthly.toExponential(2));

console.log("\nMode: ANNUAL interpretation (Mu = " + BULL_MU_RAW + " annualized)");
let w_annual = simulate(120, 'ANNUAL_PARAMS');
console.log("Final Wealth (Annual Params): " + w_annual.toFixed(2));
