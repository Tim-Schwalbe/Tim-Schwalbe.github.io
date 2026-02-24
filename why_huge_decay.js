const targetCagr1 = 0.6536;
const targetCagr10 = 0.15;
const targetCagrTerminal = 0.06;

const init = 6000000;
let balance = init;

const MATURATION_MONTHS = 120;
const months = 30 * 12;

for (let m = 0; m < months; m++) {
    let cCagrTarget;
    if (m <= MATURATION_MONTHS) {
        const t_phase1 = m / MATURATION_MONTHS;
        cCagrTarget = targetCagr1 * (1 - t_phase1) + targetCagr10 * t_phase1;
    } else {
        const remainingMonths = Math.max(1, months - MATURATION_MONTHS - 1);
        const t_phase2 = (m - MATURATION_MONTHS) / remainingMonths;
        cCagrTarget = targetCagr10 * (1 - t_phase2) + targetCagrTerminal * t_phase2;
    }
    
    // Log return base
    const monthlyReturnLog = Math.log(1 + cCagrTarget) / 12;
    balance *= Math.exp(monthlyReturnLog);
}

console.log(`With decaying CAGR (65.36% -> 15% -> 6%), 30-year straight line: $${balance}`);
