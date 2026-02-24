// REMOVED IMPORT: simulatePortfolio from ./simulator.js
// DEPENDENCIES: window.simulatePortfolio

/**
 * Find the Safe Withdrawal Rate using Bisection Search.
 * @param {number} targetOdds - Target success probability (e.g., 0.95)
 * @param {object} marketData - Pre-generated market paths
 * @param {object} configs - Simulation configurations
 * @returns {number} - Optimized SWR as a decimal
 */
window.findSWR = async function (targetOdds, marketData, configs) {
    let low = 0.001;
    let high = 0.30;
    let best = 0.001;

    // Use the user's exact target success rate. The UI exposes this setting directly,
    // so adding a hidden margin on top would silently misrepresent the result.
    // (A previous 4% margin caused SWR to appear ~30% lower than actual for 100% crypto.)
    const requiredSuccess = Math.min(0.999, targetOdds);

    for (let i = 0; i < 25; i++) {
        if (i > 0 && i % 5 === 0 && typeof setTimeout !== 'undefined') await new Promise(r => setTimeout(r, 0));
        let mid = (low + high) / 2;
        let res = window.simulatePortfolio(mid, marketData, { ...configs, SILENT: true });
        const actualSuccess = res.successRate;

        // Use dynamic safety margin
        if (actualSuccess >= requiredSuccess) {
            best = mid;
            low = mid;
        } else {
            high = mid;
        }

        if (high - low < 0.0001) break;
    }
    return best;
}
