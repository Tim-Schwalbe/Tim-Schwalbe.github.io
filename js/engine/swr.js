// REMOVED IMPORT: simulatePortfolio from ./simulator.js
// DEPENDENCIES: window.simulatePortfolio

/**
 * Find the Safe Withdrawal Rate using Bisection Search.
 * @param {number} targetOdds - Target success probability (e.g., 0.95)
 * @param {object} marketData - Pre-generated market paths
 * @param {object} configs - Simulation configurations
 * @returns {number} - Optimized SWR as a decimal
 */
window.findSWR = function (targetOdds, marketData, configs) {
    let low = 0.001;
    let high = 0.30;
    let best = 0.001;
    const safetyMargin = 0.005; // Require 0.5% above target to account for MC variance

    for (let i = 0; i < 25; i++) {
        let mid = (low + high) / 2;
        let res = window.simulatePortfolio(mid, marketData, { ...configs, SILENT: true });
        const actualSuccess = res.successRate;

        // Use safety margin: only accept if clearly above target
        if (actualSuccess >= targetOdds + safetyMargin) {
            best = mid;
            low = mid;
        } else {
            high = mid;
        }

        if (high - low < 0.0001) break;
    }
    return best;
}
